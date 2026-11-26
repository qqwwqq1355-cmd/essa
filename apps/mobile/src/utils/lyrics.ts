const INLINE_URL_REGEX =
  /https?:\/\/\S+|www\.\S+|(?:t\.me|x\.com|twitter\.com|mmy\.ye|meyon\.com\.ye|aparat\.com|youtu\.be|youtube\.com|facebook\.com|instagram\.com)\/\S*|(?:\b(?:t\.me|x\.com|twitter\.com|mmy\.ye|meyon\.com\.ye|aparat\.com)\b)|@[a-zA-Z0-9_]{3,}/gi;

const DECORATIVE_LINE_REGEX = /^[\sـ\-_=•●▪▫*#~─━〰\uFE0F▶◀🔊🎧🎤🎬«»|/:]+$/;

const PROMO_OR_META_LINE_REGEX =
  /(?:على\s*تيليجرام|على\s*تليجرام|على\s*تويتر|حساب\s*عيسى\s*الليث|اشترك\s*في\s*القناة|رابط\s*القناة|تابعونا\s*على|الموقع\s*الرسمي)/i;

const CREDIT_PREFIX_REGEX =
  /^(?:أداء|اداء|المنشد|إنشاد|انشاد|كلمات(?:\s*الشاعر)?|الشاعر|شعر|ألحان|الحان|توزيع|هندسة|مونتاج|جرافيك|إنتاج|انتاج)\s*[|/\\:：\-–—]/i;

const VIDEO_RES_LINE_REGEX = /^(?:360|480|720|1080)p?(?:\s*[|/\-–—]|$)/i;

export function cleanLyricsLines(raw: string | null | undefined, trackTitle?: string): string[] {
  if (!raw) return [];
  const normTitle = (trackTitle || '').trim();

  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(INLINE_URL_REGEX, '').trim())
    .filter((line) => {
      if (!line) return false;
      if (DECORATIVE_LINE_REGEX.test(line)) return false;
      if (PROMO_OR_META_LINE_REGEX.test(line)) return false;
      if (CREDIT_PREFIX_REGEX.test(line)) return false;
      if (VIDEO_RES_LINE_REGEX.test(line)) return false;
      if (/^(?:مجموعة\s+إصدارات|إصدارات\s+)/i.test(line)) return false;
      if (/^عيسى\s+الليث$/i.test(line)) return false;
      return true;
    });

  // إزالة تكرار العنوان في أول سطر إن وُجد
  if (lines.length > 1 && normTitle) {
    const first = lines[0].replace(/^(?:زامل|نشيد|أنشودة|قصيدة|كليب|مونتاج)\s*[:|\-–—]?\s*/i, '').trim();
    if (first === normTitle || lines[0] === normTitle) {
      lines.shift();
    }
  }

  return lines;
}

