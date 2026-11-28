import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import type { EntityLike } from 'telegram/define';
import { loadConfig, type SyncConfig } from './config';
import { CloudflareD1SyncClient } from './dbSync';
import { mirrorAudioToPrivateChannel } from './storage/telegramMirror';
import { GitHubReleaseAudioStore } from './storage/githubRelease';
import { R2WorkerAudioStore } from './storage/r2WorkerUploader';
import { sendNewTrackNotification } from './notifier';
import { normalizeArabic } from '../../../packages/shared/src/arabic/normalize';
import { parseTelegramAudioPost } from '../../../packages/shared/src/arabic/lyricsParser';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ExtractedAudioInfo {
  durationSec: number;
  fileSizeBytes: number;
  mimeType: string;
  audioTitle: string | null;
  fileName: string | null;
}

function extractAudioFromMessage(msg: Api.Message): ExtractedAudioInfo | null {
  const media = msg.media;
  if (!(media instanceof Api.MessageMediaDocument)) return null;

  const doc = media.document;
  if (!(doc instanceof Api.Document)) return null;

  const mimeType = doc.mimeType || '';
  const isAudioMime =
    mimeType.startsWith('audio/') ||
    mimeType === 'application/octet-stream';

  let durationSec = 0;
  let audioTitle: string | null = null;
  let fileName: string | null = null;
  let hasAudioAttribute = false;

  for (const attr of doc.attributes) {
    if (attr instanceof Api.DocumentAttributeAudio) {
      hasAudioAttribute = true;
      durationSec = attr.duration || 0;
      audioTitle = attr.title || null;
    } else if (attr instanceof Api.DocumentAttributeFilename) {
      fileName = attr.fileName || null;
    }
  }

  const isMp3FileName = Boolean(fileName && /\.(mp3|m4a|ogg|wav)$/i.test(fileName));
  if (!hasAudioAttribute && !isMp3FileName && !mimeType.startsWith('audio/')) {
    return null;
  }

  if (!isAudioMime && !isMp3FileName) return null;

  return {
    durationSec,
    fileSizeBytes: Number(doc.size || 0),
    mimeType: mimeType.startsWith('audio/') ? mimeType : 'audio/mpeg',
    audioTitle,
    fileName,
  };
}

function findCompanionLyricsMessage(
  audioMsg: Api.Message,
  windowMessages: Api.Message[],
  hintTitle?: string | null
): { text: string; messageId: number } | null {
  const MAX_TIME_DIFF_SEC = 7200;
  const cleanHint = (hintTitle || '').replace(/[\u064B-\u065F\u0670ـ]/g, '').trim();

  const candidates = windowMessages.filter((m) => {
    if (m.id === audioMsg.id) return false;
    if (extractAudioFromMessage(m)) return false;
    const text = (m.message || '').trim();
    if (text.length < 30) return false;
    const timeDiff = Math.abs((m.date || 0) - (audioMsg.date || 0));
    return timeDiff <= MAX_TIME_DIFF_SEC && Math.abs(m.id - audioMsg.id) <= 12;
  });

  if (candidates.length === 0) return null;

  const scoreCandidate = (m: Api.Message): number => {
    const text = (m.message || '').trim();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const nonLinkLines = lines.filter((l) => !/(https?:\/\/|www\.)/i.test(l));
    let score = 0;

    if (nonLinkLines.length >= 4 || text.includes('〰')) score += 600;
    if (cleanHint.length >= 3) {
      const normText = text.replace(/[\u064B-\u065F\u0670ـ]/g, '');
      if (normText.includes(cleanHint)) score += 800;
    }
    if (text.length < 160 && /\b(?:360|480|720|1080)p?\b/i.test(text)) {
      score -= 500;
    }
    score -= Math.abs(m.id - audioMsg.id) * 15;
    return score;
  };

  candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  if (scoreCandidate(candidates[0]) <= 0) return null;
  return { text: candidates[0].message || '', messageId: candidates[0].id };
}

async function fetchMmyPostLyricsIfLinked(
  rawText: string
): Promise<{ lyrics: string; poet: string | null } | null> {
  const m = rawText.match(/mmy\.ye\/(\d{4,7})/i);
  if (!m) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://www.mmy.ye/wp-json/wp/v2/posts/${m[1]}?_fields=id,title,content`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const post = (await res.json()) as { content?: { rendered?: string } };
    const html = post?.content?.rendered;
    if (!html) return null;
    const plain = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
    const parsed = parseTelegramAudioPost({ caption: plain });
    if (parsed.lyricsRaw && parsed.lyricsRaw.split('\n').length >= 4) {
      return { lyrics: parsed.lyricsRaw, poet: parsed.poet };
    }
  } catch {
    // تجاهل أخطاء الاتصال المؤقتة بـ mmy.ye
  }
  return null;
}

function findCompanionPhotoMessage(
  audioMsg: Api.Message,
  batchMessages: Api.Message[]
): Api.Message | null {
  const MAX_TIME_DIFF_SEC = 1800;
  const candidates = batchMessages.filter((m) => {
    if (m.id === audioMsg.id) return false;
    if (!(m.media instanceof Api.MessageMediaPhoto)) return false;
    const timeDiff = Math.abs((m.date || 0) - (audioMsg.date || 0));
    return timeDiff <= MAX_TIME_DIFF_SEC && Math.abs(m.id - audioMsg.id) <= 4;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Math.abs(a.id - audioMsg.id) - Math.abs(b.id - audioMsg.id));
  return candidates[0];
}

async function withFloodWaitRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const waitSec =
        typeof (err as { seconds?: number })?.seconds === 'number'
          ? (err as { seconds: number }).seconds
          : null;

      if (waitSec && waitSec > 0 && waitSec <= 180) {
        console.warn(`[telegram-sync] FloodWait on ${label}: waiting ${waitSec + 2}s (attempt ${attempt}/4)...`);
        await sleep((waitSec + 2) * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Exceeded FloodWait retries for ${label}`);
}

async function processBatch(
  client: TelegramClient,
  db: CloudflareD1SyncClient,
  r2Store: R2WorkerAudioStore | null,
  githubStore: GitHubReleaseAudioStore | null,
  archivePeer: EntityLike | null,
  channelEntity: EntityLike,
  config: SyncConfig,
  messages: Api.Message[],
  existingIds: Set<number>,
  existingCoverIds: Set<number>,
  existingGoodLyricsIds: Set<number>,
  state: { highestMessageId: number; syncedCount: number; skippedCount: number },
  windowMessages?: Api.Message[]
) {
  const searchPool = windowMessages ?? messages;
  for (const msg of messages) {
    if (msg.id > state.highestMessageId) {
      state.highestMessageId = msg.id;
    }

    const audio = extractAudioFromMessage(msg);
    if (!audio) continue;

    const hintTitle = audio.audioTitle || audio.fileName?.replace(/\.(mp3|m4a|ogg|wav)$/i, '').replace(/[_-]+/g, ' ');

    if (existingIds.has(msg.id)) {
      // تحديث عدد المشاهدات الحقيقي من تليجرام للزوامل الموجودة
      const tgViews = Number(msg.views || 0);
      if (tgViews > 0) {
        await db.updateTrackViews(msg.id, tgViews);
      }
      // إذا كان الزامل موجوداً بالفعل لكن بدون صورة غلاف، نسحب الصورة المصغّرة فقط بدون إعادة رفع الصوت!
      if (config.storageMode === 'r2' && r2Store && !existingCoverIds.has(msg.id)) {
        const companionPhoto = findCompanionPhotoMessage(msg, searchPool);
        const coverKey = await r2Store.uploadCoverFromTelegramMessage(client, msg, companionPhoto);
        if (coverKey) {
          await db.updateTrackCover(msg.id, coverKey);
          existingCoverIds.add(msg.id);
          console.log(`[telegram-sync] 🖼 Cover added for existing msg #${msg.id}`);
        }
      }
      // إصلاح الكلمات الناقصة أو المفقودة للزوامل الموجودة (من الرسالة المرافقة أو mmy.ye)
      if (!existingGoodLyricsIds.has(msg.id)) {
        const companion = findCompanionLyricsMessage(msg, searchPool, hintTitle);
        const parsed = parseTelegramAudioPost({
          caption: msg.message,
          audioTitle: audio.audioTitle,
          fileName: audio.fileName,
          companionLyricsText: companion?.text,
        });
        let bestLyrics = parsed.lyricsRaw;
        let bestPoet = parsed.poet;
        const lineCount = bestLyrics ? bestLyrics.split('\n').length : 0;
        if (lineCount < 4) {
          const linked = await fetchMmyPostLyricsIfLinked(
            `${msg.message || ''}\n${companion?.text || ''}`
          );
          if (linked && linked.lyrics.split('\n').length > lineCount) {
            bestLyrics = linked.lyrics;
            if (!bestPoet && linked.poet) bestPoet = linked.poet;
          }
        }
        if (bestLyrics && bestLyrics.length >= 120) {
          await db.updateTrackLyricsAndPoet(
            msg.id,
            `tg_${msg.id}`,
            bestLyrics,
            normalizeArabic(bestLyrics),
            bestPoet,
            companion?.messageId ?? msg.id
          );
          existingGoodLyricsIds.add(msg.id);
          console.log(`[telegram-sync] 📝 Lyrics repaired for existing msg #${msg.id}`);
        }
      }
      state.skippedCount++;
      continue;
    }

    const companion = findCompanionLyricsMessage(msg, searchPool, hintTitle);
    const parsed = parseTelegramAudioPost({
      caption: msg.message,
      audioTitle: audio.audioTitle,
      fileName: audio.fileName,
      companionLyricsText: companion?.text,
    });
    if (!parsed.lyricsRaw || parsed.lyricsRaw.split('\n').length < 4) {
      const linked = await fetchMmyPostLyricsIfLinked(
        `${msg.message || ''}\n${companion?.text || ''}`
      );
      if (linked && (!parsed.lyricsRaw || linked.lyrics.split('\n').length > parsed.lyricsRaw.split('\n').length)) {
        parsed.lyricsRaw = linked.lyrics;
        if (!parsed.poet && linked.poet) parsed.poet = linked.poet;
      }
    }

    let telegramFileId: string | null = null;
    let telegramArchiveMsgId: number | null = null;
    let r2ObjectKey: string | null = null;
    let coverUrl: string | null = null;
    let finalFileSizeBytes = audio.fileSizeBytes;

    if (config.storageMode === 'r2' && r2Store) {
      const uploaded = await withFloodWaitRetry(`r2-upload #${msg.id}`, () =>
        r2Store.uploadFromTelegramMessage(client, msg)
      );
      r2ObjectKey = uploaded.objectKey;
      if (uploaded.sizeBytes > 0) {
        finalFileSizeBytes = uploaded.sizeBytes;
      }
      const companionPhoto = findCompanionPhotoMessage(msg, messages);
      coverUrl = await r2Store.uploadCoverFromTelegramMessage(client, msg, companionPhoto);
    } else if (config.storageMode === 'github' && githubStore) {
      const uploaded = await withFloodWaitRetry(`github-upload #${msg.id}`, () =>
        githubStore.uploadFromTelegramMessage(client, msg, audio.mimeType)
      );
      r2ObjectKey = uploaded.audioUrl;
      if (uploaded.sizeBytes > 0) {
        finalFileSizeBytes = uploaded.sizeBytes;
      }
    } else if (archivePeer) {
      const archived = await withFloodWaitRetry(`mirror #${msg.id}`, () =>
        mirrorAudioToPrivateChannel(
          client,
          archivePeer,
          channelEntity,
          config,
          msg,
          audio.fileSizeBytes
        )
      );
      telegramArchiveMsgId = archived.archiveMessageId;
      telegramFileId = archived.botFileId;
    }

    const publishedIso = new Date((msg.date || Math.floor(Date.now() / 1000)) * 1000).toISOString();

    await db.upsertTrack({
      id: `tg_${msg.id}`,
      sourceChannel: config.sourceChannelUsername,
      sourceMessageId: msg.id,
      title: parsed.title,
      titleNormalized: normalizeArabic(parsed.title),
      poet: parsed.poet,
      poetNormalized: normalizeArabic(parsed.poet),
      category: parsed.category,
      durationSec: audio.durationSec,
      fileSizeBytes: finalFileSizeBytes,
      mimeType: config.storageMode === 'telegram' ? audio.mimeType : 'audio/mpeg',
      storageProvider: config.storageMode,
      telegramFileId,
      telegramArchiveMsgId,
      r2ObjectKey,
      coverUrl,
      playCount: Number(msg.views || 0),
      publishedAt: publishedIso,
      lyricsRaw: parsed.lyricsRaw,
      lyricsNormalized: normalizeArabic(parsed.lyricsRaw),
      lyricsMessageId: companion?.messageId ?? (parsed.lyricsRaw ? msg.id : null),
    });

    existingIds.add(msg.id);
    state.syncedCount++;
    const tag =
      config.storageMode === 'r2'
        ? 'Cloudflare R2 ✓'
        : config.storageMode === 'github'
          ? 'GitHub CDN ✓'
          : `أرشيف #${telegramArchiveMsgId}`;
    console.log(
      `[telegram-sync] ✓ [#${state.syncedCount}] msg #${msg.id} — "${parsed.title}" (${parsed.lyricsRaw ? 'مع كلمات' : 'MP3'} | ${tag})`
    );

    // إرسال إشعار فوري للمستخدمين عند نشر زامل جديد في الوضع الدوري (incremental) فقط
    if (config.syncMode === 'incremental') {
      await sendNewTrackNotification({
        trackId: `tg_${msg.id}`,
        title: parsed.title,
        poet: parsed.poet,
        coverUrl,
        edgeApiUrl: process.env.EDGE_API_URL,
      });
    }

    await sleep(config.storageMode === 'telegram' ? 900 : 300);
  }
}

async function main() {
  const config = loadConfig();
  const db = new CloudflareD1SyncClient(config);
  const r2Store = config.storageMode === 'r2' ? new R2WorkerAudioStore(config) : null;
  const githubStore = config.storageMode === 'github' ? new GitHubReleaseAudioStore(config) : null;

  console.log(
    `[telegram-sync] Starting ${config.syncMode} sync for @${config.sourceChannelUsername} (storage=${config.storageMode})`
  );

  const client = new TelegramClient(
    new StringSession(config.telegramStringSession),
    config.telegramApiId,
    config.telegramApiHash,
    { connectionRetries: 5 }
  );

  await client.connect();

  const state = {
    highestMessageId: await db.getLastMessageId(config.sourceChannelUsername),
    syncedCount: 0,
    skippedCount: 0,
  };

  try {
    let archivePeer: EntityLike | null = null;
    if (config.storageMode === 'telegram' && config.telegramArchiveChannelId) {
      const dialogs = await client.getDialogs({ limit: 80 });
      const archiveDialog = dialogs.find(
        (d) => d.id?.toString() === config.telegramArchiveChannelId
      );
      archivePeer = archiveDialog?.entity ?? config.telegramArchiveChannelId;
    }

    const channelEntity = await client.getEntity(config.sourceChannelUsername);
    const releasePrefix = config.githubReleaseTag.replace(/-v\d+$/, '') || 'audio-opt';
    const existingIds = await db.getExistingSourceMessageIds(
      config.sourceChannelUsername,
      config.storageMode,
      releasePrefix
    );
    const existingCoverIds = await db.getSourceMessageIdsWithCover(config.sourceChannelUsername);
    const existingGoodLyricsIds = await db.getSourceMessageIdsWithGoodLyrics(
      config.sourceChannelUsername
    );

    console.log(
      `[telegram-sync] Already ready in D1 (${config.storageMode}): ${existingIds.size} tracks | Last message ID: #${state.highestMessageId}`
    );

    if (config.syncMode === 'backfill') {
      const pageSize = 100;
      let offsetId = 0;
      let totalScanned = 0;
      let prevTailMessages: Api.Message[] = [];

      while (true) {
        const rawBatch = await withFloodWaitRetry(`getMessages offset=${offsetId}`, () =>
          client.getMessages(channelEntity, {
            limit: pageSize,
            ...(offsetId > 0 ? { offsetId } : {}),
          })
        );

        const rawArray = Array.from(rawBatch);
        if (rawArray.length === 0) break;

        const batch = rawArray.filter((m): m is Api.Message => m instanceof Api.Message);
        const allIds = rawArray
          .map((m) => (typeof m?.id === 'number' ? m.id : 0))
          .filter((id) => id > 0);
        if (allIds.length === 0) break;

        const newestInBatch = Math.max(...allIds);
        const oldestInBatch = Math.min(...allIds);

        totalScanned += rawArray.length;
        console.log(
          `[telegram-sync] Scanning batch: ${batch.length}/${rawArray.length} msgs (IDs ${newestInBatch} -> ${oldestInBatch}) | Scanned: ${totalScanned} | Uploaded new: ${state.syncedCount} | Skipped ready: ${state.skippedCount}`
        );

        const contextMessages = [...prevTailMessages, ...batch];
        prevTailMessages = batch.slice(-20);

        await processBatch(
          client,
          db,
          r2Store,
          githubStore,
          archivePeer,
          channelEntity,
          config,
          batch,
          existingIds,
          existingCoverIds,
          existingGoodLyricsIds,
          state,
          contextMessages
        );

        await db.updateSyncState(
          config.sourceChannelUsername,
          state.highestMessageId,
          0,
          'ok',
          null
        );

        // لا نتوقف أبداً بسبب رسالة خدمة أو رسالة محذوفة — نواصل حتى نصل فعلاً إلى أول رسالة في القناة (#1)!
        if (oldestInBatch <= 1 || oldestInBatch === offsetId) {
          break;
        }
        offsetId = oldestInBatch;
        await sleep(600);
      }
    } else {
      const rawMessages = await client.getMessages(channelEntity, {
        minId: state.highestMessageId,
        limit: config.batchLimit,
      });

      const messages = Array.from(rawMessages)
        .filter((m): m is Api.Message => m instanceof Api.Message)
        .sort((a, b) => a.id - b.id);

      console.log(
        `[telegram-sync] Incremental check: found ${messages.length} new messages after #${state.highestMessageId}.`
      );

      await processBatch(
        client,
        db,
        r2Store,
        githubStore,
        archivePeer,
        channelEntity,
        config,
        messages,
        existingIds,
        existingCoverIds,
        existingGoodLyricsIds,
        state
      );
    }

    await db.updateSyncState(
      config.sourceChannelUsername,
      state.highestMessageId,
      state.syncedCount,
      'ok',
      null
    );

    console.log(
      `[telegram-sync] ✓ Done! Newly synced to ${config.storageMode}: ${state.syncedCount} | Already ready: ${state.skippedCount} | Latest msg ID: #${state.highestMessageId}`
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[telegram-sync] Error:', errorMessage);
    await db
      .updateSyncState(
        config.sourceChannelUsername,
        state.highestMessageId,
        state.syncedCount,
        'error',
        errorMessage
      )
      .catch(() => undefined);
    process.exitCode = 1;
  } finally {
    await client.disconnect();
    process.exit(process.exitCode ?? 0);
  }
}

main();
