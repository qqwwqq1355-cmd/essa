import type { TelegramClient, Api } from 'telegram';
import type { SyncConfig } from '../config';
import { optimizeMp3ForInstantStreaming } from './audioOptimizer';

/**
 * رافع مباشر إلى Cloudflare R2 (10GB مجاناً + بث غير محدود مجاناً 100%)
 * يمر عبر نقطة الرفع المحمية داخل Cloudflare Worker الخاص بك (بربط AUDIO_BUCKET الأصلي)
 * بدون الحاجة لحزم AWS SDK الثقيلة أو مفاتيح S3 إضافية!
 */
export class R2WorkerAudioStore {
  private readonly apiBase: string;
  private readonly uploadSecret: string;
  private readonly audioBitrate: string;

  constructor(config: SyncConfig) {
    this.apiBase = config.edgeApiUrl.replace(/\/+$/, '');
    this.uploadSecret = config.r2UploadSecret;
    this.audioBitrate = config.audioBitrate || '96k';
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.uploadSecret}`,
    };
  }

  async uploadFromTelegramMessage(
    client: TelegramClient,
    message: Api.Message
  ): Promise<{ objectKey: string; sizeBytes: number }> {
    const objectKey = `audio/tg_${message.id}.mp3`;
    const endpoint = `${this.apiBase}/v1/internal/r2/${objectKey}`;

    // 1) فحص سريع: إذا كان الملف مرفوعاً بالفعل داخل Cloudflare R2 نتخطاه فوراً
    const checkRes = await fetch(endpoint, {
      method: 'HEAD',
      headers: this.authHeaders,
    });

    if (checkRes.ok) {
      const existingSize = Number(checkRes.headers.get('Content-Length') || 0);
      return { objectKey, sizeBytes: existingSize };
    }

    // 2) تنزيل الملف من تليجرام عبر MTProto
    const raw = await client.downloadMedia(message, {});
    if (!raw || typeof raw === 'string') {
      throw new Error(`Failed to download audio bytes for message #${message.id}`);
    }

    const rawBytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBufferLike);
    if (rawBytes.byteLength === 0) {
      throw new Error(`Downloaded empty audio file for message #${message.id}`);
    }

    // 3) تحسين فوري عبر ffmpeg (إزالة الصورة الضخمة المدمجة + تحويل إلى 96kbps Fast-Start)
    const bytes = optimizeMp3ForInstantStreaming(rawBytes, message.id, this.audioBitrate);
    const savedPct = Math.max(0, Math.round((1 - bytes.byteLength / rawBytes.byteLength) * 100));
    if (savedPct > 5) {
      console.log(
        `[ffmpeg] Optimized #${message.id}: ${(rawBytes.byteLength / 1024 / 1024).toFixed(2)}MB -> ${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB (-${savedPct}%)`
      );
    }

    // 4) رفع مباشر إلى Cloudflare R2 داخل الـ Bucket الخاص بك
    const putRes = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        ...this.authHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(bytes.byteLength),
      },
      body: Buffer.from(bytes),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`Cloudflare R2 upload failed (HTTP ${putRes.status}): ${errText}`);
    }

    return { objectKey, sizeBytes: bytes.byteLength };
  }

  /**
   * سحب الصورة المصغّرة (Thumbnail) بحجم صغير جداً (~10–25 KB) من ملف الصوت أو رسالة الصورة المرافقة
   * ورفعها إلى Cloudflare R2 في covers/tg_<id>.jpg
   */
  async uploadCoverFromTelegramMessage(
    client: TelegramClient,
    audioMessage: Api.Message,
    companionPhotoMessage?: Api.Message | null
  ): Promise<string | null> {
    const objectKey = `covers/tg_${audioMessage.id}.jpg`;
    const endpoint = `${this.apiBase}/v1/internal/r2/${objectKey}`;

    try {
      // 1) إذا كانت الصورة مرفوعة مسبقاً في R2 نعيد مفتاحها فوراً
      const checkRes = await fetch(endpoint, {
        method: 'HEAD',
        headers: this.authHeaders,
      });
      if (checkRes.ok) {
        return objectKey;
      }

      // 2) محاولة سحب الصورة المصغّرة من رسالة الصورة المرافقة أو من الغلاف المدمج في ملف الصوت
      let raw: unknown = null;

      if (companionPhotoMessage) {
        const photoMedia = companionPhotoMessage.media as { photo?: { sizes?: unknown[] } } | undefined;
        const sizes = photoMedia?.photo?.sizes;
        // اختيار الحجم المتوسط/الصغير (مثل 320px) أو تنزيل الصورة مباشرة
        const preferredThumb = Array.isArray(sizes) && sizes.length > 1 ? sizes[Math.min(1, sizes.length - 1)] : undefined;
        try {
          raw = preferredThumb
            ? await client.downloadMedia(companionPhotoMessage, { thumb: preferredThumb as never })
            : await client.downloadMedia(companionPhotoMessage, {});
        } catch {
          raw = await client.downloadMedia(companionPhotoMessage, {}).catch(() => null);
        }
      }

      if (!raw || typeof raw === 'string') {
        const docMedia = audioMessage.media as { document?: { thumbs?: unknown[] } } | undefined;
        const thumbs = docMedia?.document?.thumbs;
        if (Array.isArray(thumbs) && thumbs.length > 0) {
          const bestThumb = thumbs[thumbs.length - 1];
          raw = await client
            .downloadMedia(audioMessage, { thumb: bestThumb as never })
            .catch(() => null);
        }
      }

      if (!raw || typeof raw === 'string') return null;

      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBufferLike);
      if (bytes.byteLength < 200 || bytes.byteLength > 600_000) return null;

      const putRes = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          ...this.authHeaders,
          'Content-Type': 'image/jpeg',
          'Content-Length': String(bytes.byteLength),
        },
        body: Buffer.from(bytes),
      });

      if (!putRes.ok) return null;
      return objectKey;
    } catch {
      return null;
    }
  }
}

