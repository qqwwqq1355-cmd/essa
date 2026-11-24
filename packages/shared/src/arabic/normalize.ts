/**
 * محرك تطبيع النصوص العربية للبحث الفوري الذكي (Offline FTS & Client Search)
 * يتجاهل التشكيل والتطويل ويوحد الألف والتاء المربوطة والياء المقصورة
 */

const ARABIC_DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;
const TATWEEL_REGEX = /\u0640/g;
const ALEF_VARIANTS_REGEX = /[\u0622\u0623\u0625\u0671]/g;
const PUNCTUATION_REGEX = /[^\u0600-\u06FFa-zA-Z0-9\s]/g;
const MULTI_SPACE_REGEX = /\s+/g;

export function normalizeArabic(input: string | null | undefined): string {
  if (!input) return '';

  return input
    .replace(ARABIC_DIACRITICS_REGEX, '')
    .replace(TATWEEL_REGEX, '')
    .replace(ALEF_VARIANTS_REGEX, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(PUNCTUATION_REGEX, ' ')
    .replace(MULTI_SPACE_REGEX, ' ')
    .trim()
    .toLowerCase();
}

export function tokenizeArabicQuery(query: string): string[] {
  const normalized = normalizeArabic(query);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 0);
}

/**
 * يستخرج مقتطفاً (Snippet) من الكلمات يحيط بأول تطابق لعبارة البحث
 */
export function extractMatchingSnippet(
  lyricsRaw: string | null | undefined,
  query: string,
  maxLines = 2
): string | null {
  if (!lyricsRaw || !query.trim()) return null;

  const tokens = tokenizeArabicQuery(query);
  if (tokens.length === 0) return null;

  const lines = lyricsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const normalizedLine = normalizeArabic(lines[i]);
    const matched = tokens.some((token) => normalizedLine.includes(token));
    if (matched) {
      const slice = lines.slice(i, Math.min(lines.length, i + maxLines));
      return slice.join('  •  ');
    }
  }

  return null;
}

