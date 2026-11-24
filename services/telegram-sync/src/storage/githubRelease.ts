import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { TelegramClient, Api } from 'telegram';
import type { SyncConfig } from '../config';

interface ReleaseContext {
  tag: string;
  releaseId: number;
  assetsByName: Map<string, string>;
}

interface GitHubReleaseResponse {
  id: number;
  tag_name: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
}

/**
 * يحوّل ملف MP3 الضخم (320kbps + صورة غلاف مدمجة) عبر ffmpeg إلى MP3 فوري البث:
 * - يزيل الصور والوسوم المدمجة في بداية الملف (-vn -map_metadata -1) ليبدأ الصوت من البايت الأول!
 * - يضغط بجودة 96kbps ستيريو نقية (أصغر بـ 3.5x–4x) مع ترويسة Xing للتقديم والترجيع الفوري!
 */
function optimizeMp3ForInstantStreaming(
  rawBytes: Uint8Array,
  msgId: number,
  bitrate: string
): Uint8Array {
  const tmpDir = os.tmpdir();
  const inFile = path.join(tmpDir, `essa_in_${msgId}_${Date.now()}.audio`);
  const outFile = path.join(tmpDir, `essa_out_${msgId}_${Date.now()}.mp3`);

  try {
    fs.writeFileSync(inFile, rawBytes);
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inFile,
        '-vn',
        '-map_metadata',
        '-1',
        '-acodec',
        'libmp3lame',
        '-b:a',
        bitrate,
        '-ar',
        '44100',
        '-ac',
        '2',
        '-write_xing',
        '1',
        outFile,
      ],
      { stdio: 'pipe' }
    );

    const optimized = fs.readFileSync(outFile);
    if (optimized.byteLength > 4096) {
      return new Uint8Array(optimized.buffer, optimized.byteOffset, optimized.byteLength);
    }
    return rawBytes;
  } catch (err) {
    console.warn(
      `[ffmpeg] Optimization skipped for #${msgId} (using original):`,
      err instanceof Error ? err.message : String(err)
    );
    return rawBytes;
  } finally {
    try {
      if (fs.existsSync(inFile)) fs.unlinkSync(inFile);
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    } catch {
      // تجاهل
    }
  }
}

export class GitHubReleaseAudioStore {
  private readonly owner: string;
  private readonly repo: string;
  private readonly token: string;
  private readonly baseTag: string;
  private readonly audioBitrate: string;
  private currentRelease: ReleaseContext | null = null;
  private releasePart = 1;

  constructor(config: SyncConfig) {
    const [owner, repo] = config.githubRepository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid GITHUB_REPOSITORY "${config.githubRepository}". Expected "owner/repo".`);
    }
    this.owner = owner;
    this.repo = repo;
    this.token = config.githubToken;
    this.baseTag = config.githubReleaseTag.replace(/-v\d+$/, '') || 'audio-opt';
    this.audioBitrate = config.audioBitrate || '96k';
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'essa-alleth-telegram-sync',
    };
  }

  private async getOrCreateRelease(tag: string): Promise<ReleaseContext> {
    const getUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/releases/tags/${encodeURIComponent(tag)}`;
    const res = await fetch(getUrl, { headers: this.headers });

    if (res.ok) {
      const data = (await res.json()) as GitHubReleaseResponse;
      const assetsByName = new Map<string, string>();
      for (const a of data.assets || []) {
        assetsByName.set(a.name, a.browser_download_url);
      }
      return { tag, releaseId: data.id, assetsByName };
    }

    if (res.status !== 404) {
      const text = await res.text();
      throw new Error(`GitHub Release fetch failed (HTTP ${res.status}): ${text}`);
    }

    const createUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/releases`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tag,
        name: `مكتبة عيسى الليث الصوتية — بث فوري (${tag})`,
        body: 'ملفات MP3 محسّنة للبث الفوري السريع (96kbps Fast-Start) متزامنة تلقائياً من @IssaAllaith',
        draft: false,
        prerelease: false,
      }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`GitHub Release create failed (HTTP ${createRes.status}): ${text}`);
    }

    const created = (await createRes.json()) as GitHubReleaseResponse;
    console.log(`[github-store] Created new GitHub Release "${tag}" (id=${created.id})`);
    return { tag, releaseId: created.id, assetsByName: new Map() };
  }

  private async ensureActiveRelease(): Promise<ReleaseContext> {
    while (true) {
      const tag = `${this.baseTag}-v${this.releasePart}`;
      if (!this.currentRelease || this.currentRelease.tag !== tag) {
        this.currentRelease = await this.getOrCreateRelease(tag);
      }
      if (this.currentRelease.assetsByName.size < 950) {
        return this.currentRelease;
      }
      this.releasePart++;
      this.currentRelease = null;
    }
  }

  async uploadFromTelegramMessage(
    client: TelegramClient,
    message: Api.Message,
    _mimeType: string
  ): Promise<{ audioUrl: string; assetName: string; sizeBytes: number }> {
    const assetName = `tg_${message.id}.mp3`;
    const release = await this.ensureActiveRelease();

    const existingUrl = release.assetsByName.get(assetName);
    if (existingUrl) {
      return { audioUrl: existingUrl, assetName, sizeBytes: 0 };
    }

    // 1) تنزيل الملف من تليجرام عبر MTProto
    const raw = await client.downloadMedia(message, {});
    if (!raw || typeof raw === 'string') {
      throw new Error(`Failed to download audio bytes for message #${message.id}`);
    }

    const rawBytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBufferLike);
    if (rawBytes.byteLength === 0) {
      throw new Error(`Downloaded empty audio file for message #${message.id}`);
    }

    // 2) تحسين فوري عبر ffmpeg (إزالة الصورة الضخمة المدمجة + تحويل إلى 96kbps Fast-Start)
    const bytes = optimizeMp3ForInstantStreaming(rawBytes, message.id, this.audioBitrate);
    const savedPct = Math.max(0, Math.round((1 - bytes.byteLength / rawBytes.byteLength) * 100));
    if (savedPct > 5) {
      console.log(
        `[ffmpeg] Optimized #${message.id}: ${(rawBytes.byteLength / 1024 / 1024).toFixed(2)}MB -> ${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB (-${savedPct}%)`
      );
    }

    // 3) الرفع إلى GitHub Releases
    const uploadUrl = `https://uploads.github.com/repos/${this.owner}/${this.repo}/releases/${release.releaseId}/assets?name=${encodeURIComponent(assetName)}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(bytes.byteLength),
      },
      body: bytes,
    });

    if (uploadRes.status === 422) {
      const fallbackUrl = `https://github.com/${this.owner}/${this.repo}/releases/download/${release.tag}/${assetName}`;
      release.assetsByName.set(assetName, fallbackUrl);
      return { audioUrl: fallbackUrl, assetName, sizeBytes: bytes.byteLength };
    }

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`GitHub Asset upload failed (HTTP ${uploadRes.status}): ${errText}`);
    }

    const uploaded = (await uploadRes.json()) as { browser_download_url: string };
    const finalUrl =
      uploaded.browser_download_url ||
      `https://github.com/${this.owner}/${this.repo}/releases/download/${release.tag}/${assetName}`;

    release.assetsByName.set(assetName, finalUrl);
    return { audioUrl: finalUrl, assetName, sizeBytes: bytes.byteLength };
  }
}
