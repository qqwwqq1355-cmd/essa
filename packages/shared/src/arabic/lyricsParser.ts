import type { ArtworkPalette, ParsedTelegramPost, TrackCategory } from '../types/track';

const CHANNEL_NOISE_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/gi,
  /www\.\S+/gi,
  /(?:x\.com|twitter\.com|mmy\.ye|meyon\.com\.ye|aparat\.com)\S*/gi,
  /t\.me\/[^\s]+/gi,
  /@[a-zA-Z0-9_]{3,}/g,
  /[ـ〰\uFE0F]{2,}/g,
  /اشترك.*القناة.*/gi,
  /للاشتراك.*تليجرام.*/gi,
  /قناة\s+عيسى\s+الليث\s+الرسمية/gi,
  /تابعونا\s+على.*/gi,
  /رابط\s+القناة.*/gi,
  /[⬇️👇🔗📢🎵🎙️✨⭐🔥]+/g,
];

const POET_LINE_REGEX = /(?:كلمات\s*(?:الشاعر)?|الشاعر|شعر)\s*[|/\\:：\-–—]?\s*([^\n|•#]+)/i;
const TITLE_PREFIX_REGEX = /^(?:زامل|نشيد|أنشودة|قصيدة|شيلة|مقطع|جديد)\s*[:：\-]?\s*/i;
const HASHTAG_REGEX = /#([\u0600-\u06FFa-zA-Z0-9_]+)/g;

const PALETTE_PRESETS: ArtworkPalette[] = [
  { primary: '#1E2A38', secondary: '#0F151D', accent: '#E2A84B', pattern: 'geometric' },
  { primary: '#16302B', secondary: '#0B1916', accent: '#35C996', pattern: 'arch' },
  { primary: '#2D1F2D', secondary: '#140E16', accent: '#E59A6B', pattern: 'stars' },
  { primary: '#25213B', secondary: '#100E1B', accent: '#9B8CFF', pattern: 'waves' },
  { primary: '#332418', secondary: '#160F09', accent: '#F0B35B', pattern: 'geometric' },
  { primary: '#182C3A', secondary: '#0B141C', accent: '#4DB8E8', pattern: 'waves' },
];

export function getDeterministicPalette(seed: number): ArtworkPalette {
  const index = Math.abs(seed) % PALETTE_PRESETS.length;
  return PALETTE_PRESETS[index];
}

export function inferCategory(text: string, hashtags: string[]): TrackCategory {
  const combined = `${text} ${hashtags.join(' ')}`;
  if (/زامل|زوامل/.test(combined)) return 'زوامل';
  if (/نشيد|انشودة|أنشودة|أناشيد|اناشيد/.test(combined)) return 'أناشيد';
  if (/قصيدة|قصائد|شعر/.test(combined)) return 'قصائد';
  if (/تراث|تراثية|شعبي/.test(combined)) return 'تراثية';
  if (/عيد|رمضان|مولد|مناسبة|مناسبات/.test(combined)) return 'مناسبات';
  return 'زوامل';
}

function cleanFileNameToTitle(fileName?: string | null): string {
  if (!fileName) return '';
  return fileName
    .replace(/\.(mp3|m4a|ogg|wav|flac)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/@[a-zA-Z0-9_]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * يحلل منشور تليجرام من قناة @IssaAllaith ويستخلص العنوان والشاعر والتصنيف والكلمات الصافية
 */
export function parseTelegramAudioPost(input: {
  caption?: string | null;
  audioTitle?: string | null;
  fileName?: string | null;
  companionLyricsText?: string | null;
}): ParsedTelegramPost {
  const rawCombined = [input.caption, input.companionLyricsText]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join('\n\n');

  const hashtags: string[] = [];
  let match: RegExpExecArray | null;
  const tagScanner = new RegExp(HASHTAG_REGEX.source, 'g');
  while ((match = tagScanner.exec(rawCombined)) !== null) {
    hashtags.push(match[1].replace(/_/g, ' '));
  }

  // استخراج اسم الشاعر قبل التنظيف
  const poetMatch = rawCombined.match(POET_LINE_REGEX);
  const poet = poetMatch ? poetMatch[1].trim().replace(/[•|]+$/, '').trim() : null;

  // تنظيف النص من الروابط والإعلانات والهاشتاقات
  let cleaned = rawCombined.replace(HASHTAG_REGEX, '');
  for (const pattern of CHANNEL_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  const rawLines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[_\-=*~•]{3,}$/.test(l));

  // تحديد العنوان بدقة: ID3 Title ثم أول سطر مناسب ثم اسم الملف
  let title = (input.audioTitle || '').trim();
  const contentLines = [...rawLines];

  if (!title && contentLines.length > 0) {
    const firstLine = contentLines[0];
    if (firstLine.length <= 75 && !POET_LINE_REGEX.test(firstLine)) {
      title = firstLine.replace(TITLE_PREFIX_REGEX, '').trim() || firstLine;
      contentLines.shift();
    }
  }

  if (!title) {
    title = cleanFileNameToTitle(input.fileName) || 'مقطع صوتي — عيسى الليث';
  }

  // تصفية سطور البيانات الوصفية للإبقاء على الكلمات/الأبيات فقط
  const lyricsLines = contentLines.filter((line) => {
    if (POET_LINE_REGEX.test(line)) return false;
    if (/^(?:أداء|اداء|المنشد|إنشاد|انشاد)\s*[:：\-]?/i.test(line)) return false;
    if (/^(?:هندسة|توزيع|إنتاج|انتاج|جرافيك|مونتاج)\s*[:：\-]?/i.test(line)) return false;
    if (line === title) return false;
    return true;
  });

  const lyricsRaw = lyricsLines.length >= 2 ? lyricsLines.join('\n') : null;
  const category = inferCategory(`${title} ${rawCombined}`, hashtags);

  return {
    title,
    poet,
    category,
    lyricsRaw,
    hashtags,
  };
}

