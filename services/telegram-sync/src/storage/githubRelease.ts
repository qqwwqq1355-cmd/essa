import type { TelegramClient, Api } from 'telegram';
import type { SyncConfig } from '../config';

interface ReleaseContext {
  tag: string;
  releaseId: number;
  assetsByName: Map<string, string>; // assetName -> browser_download_url
}

interface GitHubReleaseResponse {
  id: number;
  tag_name: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
}

/**
 * مخزن MP3 مجاني 100% وغير محدود عبر GitHub Releases (بدون Telegram Bot API وبدون 429!)
 * - ينشئ إصدار (Release) تلقائياً باسم audio-v1 (ويتوسع إلى audio-v2 تلقائياً عند تجاوز 950 ملفاً)
 * - يتخطى إعادة رفع أي ملف موجود مسبقاً
 * - يعيد رابط CDN دائم وسريع يدعم التقديم والترجيع HTTP 206
 */
export class GitHubReleaseAudioStore {
  private readonly owner: string;
  private readonly repo: string;
  private readonly token: string;
  private readonly baseTag: string;
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
    this.baseTag = config.githubReleaseTag.replace(/-v\d+$/, '') || 'audio';
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

    // إنشاء Release جديد تلقائياً
    const createUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/releases`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tag,
        name: `مكتبة عيسى الليث الصوتية (${tag})`,
        body: 'أرشيف ملفات MP3 المتزامن تلقائياً من القناة الرسمية @IssaAllaith',
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
      // حد GitHub هو 1000 ملف لكل Release — ننتقل تلقائياً للجزء التالي عند 950
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
    mimeType: string
  ): Promise<{ audioUrl: string; assetName: string }> {
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'mp3';
    const assetName = `tg_${message.id}.${ext}`;
    const release = await this.ensureActiveRelease();

    // إذا كان الملف مرفوعاً مسبقاً نعيد رابطه فوراً بدون إعادة تحميل أو رفع!
    const existingUrl = release.assetsByName.get(assetName);
    if (existingUrl) {
      return { audioUrl: existingUrl, assetName };
    }

    // 1) تنزيل بايتات الـ MP3 من تليجرام مباشرة عبر MTProto (سريع جداً على خوادم GitHub Actions!)
    const raw = await client.downloadMedia(message, {});
    if (!raw || typeof raw === 'string') {
      throw new Error(`Failed to download audio bytes for message #${message.id}`);
    }

    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBufferLike);
    if (bytes.byteLength === 0) {
      throw new Error(`Downloaded empty audio file for message #${message.id}`);
    }

    // 2) الرفع المباشر إلى GitHub Releases
    const uploadUrl = `https://uploads.github.com/repos/${this.owner}/${this.repo}/releases/${release.releaseId}/assets?name=${encodeURIComponent(assetName)}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': mimeType || 'audio/mpeg',
        'Content-Length': String(bytes.byteLength),
      },
      body: bytes,
    });

    if (uploadRes.status === 422) {
      // الملف موجود بالفعل في الـ Release
      const fallbackUrl = `https://github.com/${this.owner}/${this.repo}/releases/download/${release.tag}/${assetName}`;
      release.assetsByName.set(assetName, fallbackUrl);
      return { audioUrl: fallbackUrl, assetName };
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
    return { audioUrl: finalUrl, assetName };
  }
}
