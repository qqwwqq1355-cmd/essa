import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import type { EntityLike } from 'telegram/define';
import { loadConfig, type SyncConfig } from './config';
import { CloudflareD1SyncClient } from './dbSync';
import { mirrorAudioToPrivateChannel } from './storage/telegramMirror';
import { GitHubReleaseAudioStore } from './storage/githubRelease';
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
  batchMessages: Api.Message[]
): { text: string; messageId: number } | null {
  const MAX_TIME_DIFF_SEC = 600;

  const candidates = batchMessages.filter((m) => {
    if (m.id === audioMsg.id) return false;
    if (extractAudioFromMessage(m)) return false;
    const text = (m.message || '').trim();
    if (text.length < 35) return false;
    const timeDiff = Math.abs((m.date || 0) - (audioMsg.date || 0));
    return timeDiff <= MAX_TIME_DIFF_SEC && Math.abs(m.id - audioMsg.id) <= 2;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => Math.abs(a.id - audioMsg.id) - Math.abs(b.id - audioMsg.id));
  return { text: candidates[0].message || '', messageId: candidates[0].id };
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
  githubStore: GitHubReleaseAudioStore | null,
  archivePeer: EntityLike | null,
  channelEntity: EntityLike,
  config: SyncConfig,
  messages: Api.Message[],
  existingIds: Set<number>,
  state: { highestMessageId: number; syncedCount: number; skippedCount: number }
) {
  for (const msg of messages) {
    if (msg.id > state.highestMessageId) {
      state.highestMessageId = msg.id;
    }

    const audio = extractAudioFromMessage(msg);
    if (!audio) continue;

    if (existingIds.has(msg.id)) {
      state.skippedCount++;
      continue;
    }

    const companion = findCompanionLyricsMessage(msg, messages);
    const parsed = parseTelegramAudioPost({
      caption: msg.message,
      audioTitle: audio.audioTitle,
      fileName: audio.fileName,
      companionLyricsText: companion?.text,
    });

    let telegramFileId: string | null = null;
    let telegramArchiveMsgId: number | null = null;
    let audioObjectUrl: string | null = null;
    let finalFileSizeBytes = audio.fileSizeBytes;

    if (config.storageMode === 'github' && githubStore) {
      const uploaded = await withFloodWaitRetry(`github-upload #${msg.id}`, () =>
        githubStore.uploadFromTelegramMessage(client, msg, audio.mimeType)
      );
      audioObjectUrl = uploaded.audioUrl;
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
      mimeType: config.storageMode === 'github' ? 'audio/mpeg' : audio.mimeType,
      storageProvider: config.storageMode,
      telegramFileId,
      telegramArchiveMsgId,
      r2ObjectKey: audioObjectUrl,
      publishedAt: publishedIso,
      lyricsRaw: parsed.lyricsRaw,
      lyricsNormalized: normalizeArabic(parsed.lyricsRaw),
      lyricsMessageId: companion?.messageId ?? (parsed.lyricsRaw ? msg.id : null),
    });

    existingIds.add(msg.id);
    state.syncedCount++;
    console.log(
      `[telegram-sync] ✓ [#${state.syncedCount}] msg #${msg.id} — "${parsed.title}" (${parsed.lyricsRaw ? 'مع كلمات' : 'MP3'} | ${config.storageMode === 'github' ? 'GitHub CDN ✓' : `أرشيف #${telegramArchiveMsgId}`})`
    );

    await sleep(config.storageMode === 'github' ? 400 : 900);
  }
}

async function main() {
  const config = loadConfig();
  const db = new CloudflareD1SyncClient(config);
  const githubStore = config.storageMode === 'github' ? new GitHubReleaseAudioStore(config) : null;

  console.log(
    `[telegram-sync] Starting ${config.syncMode} sync for @${config.sourceChannelUsername} (storage=${config.storageMode}, repo=${config.githubRepository})`
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

    console.log(
      `[telegram-sync] Already ready in D1 (${config.storageMode}): ${existingIds.size} tracks | Last message ID: #${state.highestMessageId}`
    );

    if (config.syncMode === 'backfill') {
      const pageSize = 100;
      let offsetId = 0;
      let totalScanned = 0;

      while (true) {
        const rawBatch = await withFloodWaitRetry(`getMessages offset=${offsetId}`, () =>
          client.getMessages(channelEntity, {
            limit: pageSize,
            ...(offsetId > 0 ? { offsetId } : {}),
          })
        );

        const batch = Array.from(rawBatch).filter((m): m is Api.Message => m instanceof Api.Message);
        if (batch.length === 0) break;

        totalScanned += batch.length;
        const oldestInBatch = batch[batch.length - 1].id;
        console.log(
          `[telegram-sync] Scanning batch: ${batch.length} msgs (IDs ${batch[0].id} -> ${oldestInBatch}) | Scanned: ${totalScanned} | Uploaded new: ${state.syncedCount} | Skipped ready: ${state.skippedCount}`
        );

        await processBatch(
          client,
          db,
          githubStore,
          archivePeer,
          channelEntity,
          config,
          batch,
          existingIds,
          state
        );

        await db.updateSyncState(
          config.sourceChannelUsername,
          state.highestMessageId,
          0,
          'ok',
          null
        );

        if (batch.length < pageSize || oldestInBatch <= 1) {
          break;
        }
        offsetId = oldestInBatch;
        await sleep(1000);
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
        githubStore,
        archivePeer,
        channelEntity,
        config,
        messages,
        existingIds,
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
      `[telegram-sync] ✓ Done! Newly synced: ${state.syncedCount} | Already ready: ${state.skippedCount} | Latest msg ID: #${state.highestMessageId}`
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
