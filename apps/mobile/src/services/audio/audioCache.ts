const AUDIO_CACHE_NAME = 'essa-alleth-audio-v1';

// خريطة روابط Blob المؤقتة في الذاكرة لتسريع إعادة التشغيل الفوري
const blobUrlMap = new Map<string, string>();
const inFlightUrls = new Set<string>();
let activeBgController: AbortController | null = null;

/**
 * إلغاء أي تنزيل خلفي جارٍ فوراً عند الانتقال لزامل جديد حتى يحصل الزامل الجديد على 100% من سرعة الإنترنت
 */
export function abortBackgroundCaching(): void {
  if (activeBgController) {
    activeBgController.abort();
    activeBgController = null;
  }
}

function isCacheSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * يتحقق إن كان الملف الصوتي مخزّناً مسبقاً (أوفلاين) ويعيد رابط Blob محلي فوري
 */
export async function getCachedAudioUrl(streamUrl: string): Promise<string | null> {
  if (!streamUrl || streamUrl.startsWith('blob:')) return null;

  const existingBlob = blobUrlMap.get(streamUrl);
  if (existingBlob) return existingBlob;

  if (!isCacheSupported()) return null;

  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const match = await cache.match(streamUrl);
    if (!match) return null;

    const blob = await match.blob();
    if (!blob || blob.size === 0) return null;

    const blobUrl = URL.createObjectURL(blob);
    blobUrlMap.set(streamUrl, blobUrl);
    return blobUrl;
  } catch {
    return null;
  }
}

/**
 * يحفظ الملف الصوتي في الخلفية أثناء تشغيله (بدون أي تأثير على سرعة التشغيل)
 */
export function cacheAudioInBackground(
  streamUrl: string,
  onCached?: () => void
): void {
  if (!streamUrl || streamUrl.startsWith('blob:') || !isCacheSupported()) return;
  if (blobUrlMap.has(streamUrl) || inFlightUrls.has(streamUrl)) return;

  abortBackgroundCaching();
  const controller = new AbortController();
  activeBgController = controller;
  inFlightUrls.add(streamUrl);

  void (async () => {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const already = await cache.match(streamUrl);
      if (already) {
        onCached?.();
        return;
      }

      const response = await fetch(streamUrl, {
        mode: 'cors',
        signal: controller.signal,
      });
      if (!response.ok) return;

      await cache.put(streamUrl, response.clone());
      onCached?.();
    } catch {
      // تجاهل أخطاء الشبكة أو الإلغاء بصمت حتى لا يتأثر التشغيل
    } finally {
      inFlightUrls.delete(streamUrl);
      if (activeBgController === controller) {
        activeBgController = null;
      }
    }
  })();
}

interface AndroidAudioBridge {
  saveBase64Mp3?: (dataUrl: string, fileName: string) => void;
}

function getAndroidAudioBridge(): AndroidAudioBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { AndroidBridge?: AndroidAudioBridge }).AndroidBridge;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * حفظ الملف الصوتي كملف MP3 حقيقي في ذاكرة الجهاز:
 * - في تطبيق الأندرويد: يحفظ داخل مجلد "الموسيقى / عيسى الليث" (Music/عيسى الليث)
 * - في المتصفح: ينزّل إلى مجلد التنزيلات (Downloads)
 * - إذا كان الزامل محفوظاً مسبقاً في كاش التطبيق، يتم تصديره فوراً بدون إعادة تحميل من الإنترنت
 */
export async function saveAudioToDevice(
  streamUrl: string,
  title: string
): Promise<boolean> {
  if (!streamUrl || typeof document === 'undefined') return false;

  const safeName =
    title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'زامل_عيسى_الليث';
  const fileName = safeName.endsWith('.mp3') ? safeName : `${safeName}.mp3`;
  const androidBridge = getAndroidAudioBridge();

  const exportBlob = async (blob: Blob): Promise<boolean> => {
    if (androidBridge?.saveBase64Mp3) {
      const dataUrl = await blobToDataUrl(blob);
      androidBridge.saveBase64Mp3(dataUrl, fileName);
      return true;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  };

  try {
    // 1) التحقق من الكاش المحلي أولاً (حفظ فوري بدون إنترنت!)
    if (isCacheSupported() && !streamUrl.startsWith('blob:')) {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const cached = await cache.match(streamUrl);
      if (cached) {
        const blob = await cached.blob();
        if (blob && blob.size > 0) {
          return await exportBlob(blob);
        }
      }
    }

    // 2) تحميله وحفظه في الكاش وتنزيله للجهاز معاً
    const res = await fetch(streamUrl, { mode: 'cors' });
    if (res.ok) {
      if (isCacheSupported() && !streamUrl.startsWith('blob:')) {
        try {
          const cache = await caches.open(AUDIO_CACHE_NAME);
          await cache.put(streamUrl, res.clone());
        } catch {
          // تجاهل
        }
      }
      const blob = await res.blob();
      return await exportBlob(blob);
    }
  } catch {
    // في حال قيود CORS نستخدم التنزيل المباشر للرابط
  }

  const a = document.createElement('a');
  a.href = streamUrl;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

/**
 * حذف مقطع معين من الكاش المحلي
 */
export async function removeCachedAudio(streamUrl: string | null | undefined): Promise<void> {
  if (!streamUrl) return;
  const blobUrl = blobUrlMap.get(streamUrl);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrlMap.delete(streamUrl);
  }
  if (!isCacheSupported()) return;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.delete(streamUrl);
  } catch {
    // تجاهل
  }
}

/**
 * تفريغ جميع المقاطع المحفوظة أوفلاين
 */
export async function clearAllCachedAudio(): Promise<void> {
  for (const url of blobUrlMap.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlMap.clear();
  if (!isCacheSupported()) return;
  try {
    await caches.delete(AUDIO_CACHE_NAME);
  } catch {
    // تجاهل
  }
}

