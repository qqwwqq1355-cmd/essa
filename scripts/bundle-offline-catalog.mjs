import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const API_BASE = (process.env.VITE_API_BASE_URL || 'https://essa-pages-proxy.vercel.app').replace(/\/+$/, '');
const OUT_DIR = path.resolve('apps/mobile/public/offline');
const COVERS_DIR = path.join(OUT_DIR, 'covers');

fs.mkdirSync(COVERS_DIR, { recursive: true });

const INLINE_URL_REGEX =
  /https?:\/\/\S+|www\.\S+|(?:t\.me|x\.com|twitter\.com|mmy\.ye|meyon\.com\.ye|aparat\.com|youtu\.be|youtube\.com|facebook\.com|instagram\.com)\/\S*|(?:\b(?:t\.me|x\.com|twitter\.com|mmy\.ye|meyon\.com\.ye|aparat\.com)\b)|@[a-zA-Z0-9_]{3,}/gi;

const DECORATIVE_LINE_REGEX = /^[\sـ\-_=•●▪▫*#~─━〰\uFE0F▶◀🔊🎧🎤🎬«»|/:]+$/;

const PROMO_OR_META_LINE_REGEX =
  /(?:على\s*تيليجرام|على\s*تليجرام|على\s*تويتر|حساب\s*عيسى\s*الليث|اشترك\s*في\s*القناة|رابط\s*القناة|تابعونا\s*على|الموقع\s*الرسمي)/i;

const POET_EXTRACT_REGEX = /(?:كلمات\s*(?:الشاعر)?|الشاعر|شعر)\s*[|/\\:：\-–—]+\s*([^\n|<•#]+)/i;

const CREDIT_PREFIX_REGEX =
  /^(?:أداء|اداء|المنشد|إنشاد|انشاد|كلمات(?:\s*الشاعر)?|الشاعر|شعر|ألحان|الحان|توزيع|هندسة|مونتاج|جرافيك|إنتاج|انتاج)\s*[|/\\:：\-–—]/i;

const VIDEO_RES_LINE_REGEX = /^(?:360|480|720|1080)p?(?:\s*[|/\-–—]|$)/i;

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function htmlToPlainText(raw) {
  const withBreaks = String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withBreaks);
}

function parsePoemAndPoet(rawInput, trackTitle) {
  const str = String(rawInput || '');
  const mmyMatch = str.match(/mmy\.ye\/(\d{4,7})/i);
  const mmyPostId = mmyMatch ? mmyMatch[1] : null;

  const plain = htmlToPlainText(str);
  const poetMatch = plain.match(POET_EXTRACT_REGEX);
  const poet = poetMatch ? poetMatch[1].replace(/[•|]+$/g, '').trim() : null;

  const normTitle = (trackTitle || '').trim();
  const lines = plain
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

  if (lines.length > 1 && normTitle) {
    const first = lines[0].replace(/^(?:زامل|نشيد|أنشودة|قصيدة|كليب|مونتاج)\s*[:|\-–—]?\s*/i, '').trim();
    if (first === normTitle || lines[0] === normTitle) {
      lines.shift();
    }
  }

  return { lines, poet: poet || null, mmyPostId };
}

function normAr(s) {
  return decodeHtmlEntities(s)
    .replace(/[\u064B-\u065F\u0670ـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function baseSearchTitle(title) {
  return String(title || '')
    .replace(/\b(?:بدون\s*موسيقى|بدون\s*ايقاع|بدون\s*إيقاع|نسخة\s*\S*|زامل|نشيد|أنشودة|انشودة|كليب|مونتاج)\b/gi, ' ')
    .replace(/[-–—|()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function fetchAllTracks() {
  const all = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`${API_BASE}/v1/sync?limit=250&offset=${offset}`);
    if (!res.ok) throw new Error(`Sync HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data.tracks) ? data.tracks : [];
    for (const t of list) {
      if (t.isDeleted) continue;
      if (t.streamUrl && /^https?:\/\/[^/]+\.(workers|pages)\.dev\//i.test(t.streamUrl)) {
        t.streamUrl = t.streamUrl.replace(/^https?:\/\/[^/]+\.(workers|pages)\.dev/i, API_BASE);
      }
      if (t.coverUrl && /^https?:\/\/[^/]+\.(workers|pages)\.dev\//i.test(t.coverUrl)) {
        t.coverUrl = t.coverUrl.replace(/^https?:\/\/[^/]+\.(workers|pages)\.dev/i, API_BASE);
      }
      all.push(t);
    }
    if (!data.hasMore || list.length === 0) break;
    offset += 250;
  }
  return all;
}

async function downloadAndCompressCover(track, useFfmpeg) {
  if (!track.coverUrl) return null;
  const webpName = `${track.id}.webp`;
  const jpgName = `${track.id}.jpg`;
  const webpPath = path.join(COVERS_DIR, webpName);
  const jpgPath = path.join(COVERS_DIR, jpgName);
  const tmpPath = path.join(COVERS_DIR, `${track.id}.tmp.jpg`);

  try {
    const res = await fetch(track.coverUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return null;

    let finalName = jpgName;
    if (useFfmpeg) {
      fs.writeFileSync(tmpPath, buf);
      try {
        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-i',
            tmpPath,
            '-vf',
            'scale=96:96:force_original_aspect_ratio=increase,crop=96:96',
            '-c:v',
            'libwebp',
            '-lossless',
            '0',
            '-compression_level',
            '6',
            '-q:v',
            '52',
            webpPath,
          ],
          { stdio: 'ignore' }
        );
        fs.rmSync(tmpPath, { force: true });
        finalName = webpName;
      } catch {
        fs.renameSync(tmpPath, jpgPath);
        finalName = jpgName;
      }
    } else {
      fs.writeFileSync(jpgPath, buf);
    }

    return `./offline/covers/${finalName}`;
  } catch {
    return null;
  }
}

async function enrichTrackLyrics(tracks) {
  let enrichedById = 0;
  let enrichedBySearch = 0;
  let enrichedBySibling = 0;

  // المرحلة 1: استكمال الكلمات من رابط mmy.ye/<postId> المباشر (خاصة المقطوعة عند حد تليجرام 1024 حرف أو الفيديوهات)
  const stage1Targets = tracks.filter((t) => {
    const rawLen = (t.lyrics || '').length;
    const parsed = parsePoemAndPoet(t.lyrics, t.title);
    t._parsedLines = parsed.lines;
    t._mmyPostId = parsed.mmyPostId;
    if (!t.poet && parsed.poet) t.poet = parsed.poet;
    return Boolean(parsed.mmyPostId && (parsed.lines.length < 6 || (rawLen >= 900 && rawLen <= 1050)));
  });

  let s1Idx = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (s1Idx < stage1Targets.length) {
        const t = stage1Targets[s1Idx++];
        const post = await fetchJsonWithTimeout(
          `https://www.mmy.ye/wp-json/wp/v2/posts/${t._mmyPostId}?_fields=id,title,content`
        );
        if (!post?.content?.rendered) continue;
        const parsed = parsePoemAndPoet(post.content.rendered, t.title);
        if (parsed.lines.length > (t._parsedLines?.length || 0)) {
          t.lyrics = parsed.lines.join('\n');
          t.hasLyrics = true;
          t._parsedLines = parsed.lines;
          if (!t.poet && parsed.poet) t.poet = parsed.poet;
          enrichedById++;
        }
      }
    })
  );

  // المرحلة 2: البحث في mmy.ye عن الزوامل التي ما زالت بدون كلمات أو بكلمات ناقصة (< 4 أبيات)
  const stage2Targets = tracks.filter((t) => (t._parsedLines?.length || 0) < 4);
  let s2Idx = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (s2Idx < stage2Targets.length) {
        const t = stage2Targets[s2Idx++];
        const q = baseSearchTitle(t.title);
        const normQ = normAr(q);
        if (normQ.length < 3) continue;

        const posts = await fetchJsonWithTimeout(
          `https://www.mmy.ye/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=8&_fields=id,title,content`
        );
        if (!Array.isArray(posts)) continue;

        const match = posts.find((p) => {
          const htmlLen = p?.content?.rendered?.length || 0;
          if (htmlLen < 120 || htmlLen >= 15000) return false;
          const normTitle = normAr(p?.title?.rendered || '');
          if (!normTitle.includes(normQ)) return false;
          const normAll = `${normTitle} ${normAr(p.content.rendered)}`;
          return (
            normAll.includes('عيسي الليث') ||
            normTitle.includes('زامل') ||
            normTitle.includes('فرقه انصار الله')
          );
        });

        if (!match) continue;
        const parsed = parsePoemAndPoet(match.content.rendered, t.title);
        if (parsed.lines.length >= 4) {
          t.lyrics = parsed.lines.join('\n');
          t.hasLyrics = true;
          t._parsedLines = parsed.lines;
          if (!t.poet && parsed.poet) t.poet = parsed.poet;
          enrichedBySearch++;
        }
      }
    })
  );

  // المرحلة 3: مطابقة العنوان المتشابه بين الزوامل نفسها (مثل النسخ بدون موسيقى)
  const byTitleMap = new Map();
  for (const t of tracks) {
    if ((t._parsedLines?.length || 0) >= 4) {
      const key = normAr(baseSearchTitle(t.title));
      if (key.length >= 3 && !byTitleMap.has(key)) {
        byTitleMap.set(key, { lines: t._parsedLines, poet: t.poet || null });
      }
    }
  }
  for (const t of tracks) {
    if ((t._parsedLines?.length || 0) < 4) {
      const key = normAr(baseSearchTitle(t.title));
      const sibling = byTitleMap.get(key);
      if (sibling && sibling.lines.length > (t._parsedLines?.length || 0)) {
        t.lyrics = sibling.lines.join('\n');
        t.hasLyrics = true;
        t._parsedLines = sibling.lines;
        if (!t.poet && sibling.poet) t.poet = sibling.poet;
        enrichedBySibling++;
      }
    }
  }

  // المرحلة 4: تنسيق وتنظيف نهائي لكل القصائد وإزالة الحقول المؤقتة
  let withFullLyrics = 0;
  for (const t of tracks) {
    const finalParsed = parsePoemAndPoet(t.lyrics, t.title);
    const clean = finalParsed.lines;
    t.lyrics = clean.length >= 2 ? clean.join('\n') : null;
    t.hasLyrics = clean.length >= 2;
    if (!t.poet && finalParsed.poet) t.poet = finalParsed.poet;
    if (t.hasLyrics) withFullLyrics++;
    delete t._parsedLines;
    delete t._mmyPostId;
  }

  console.log(
    `[bundle-offline] Lyrics enriched: mmy-id=${enrichedById}, mmy-search=${enrichedBySearch}, sibling=${enrichedBySibling} | Total with clean lyrics=${withFullLyrics}/${tracks.length}`
  );
  return withFullLyrics;
}

async function main() {
  console.log(`[bundle-offline] Fetching catalog from ${API_BASE}...`);
  const tracks = await fetchAllTracks();
  const useFfmpeg = hasFfmpeg();
  console.log(`[bundle-offline] Fetched ${tracks.length} tracks (ffmpeg=${useFfmpeg}). Enriching lyrics & compressing covers...`);

  const [withFullLyrics] = await Promise.all([
    enrichTrackLyrics(tracks),
    (async () => {
      const CONCURRENCY = 12;
      let idx = 0;
      async function worker() {
        while (idx < tracks.length) {
          const i = idx++;
          const t = tracks[i];
          if (!t.coverUrl) continue;
          const localUrl = await downloadAndCompressCover(t, useFfmpeg);
          if (localUrl) {
            t.coverUrl = localUrl;
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    })(),
  ]);

  const bundledCovers = tracks.filter((t) => t.coverUrl?.startsWith('./offline/covers/')).length;

  const slimTracks = tracks.map((t) => {
    const { titleNormalized: _tn, lyricsNormalized: _ln, ...rest } = t;
    return rest;
  });

  const catalogPath = path.join(OUT_DIR, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify({ tracks: slimTracks }), 'utf8');
  const jsonKb = Math.round(fs.statSync(catalogPath).size / 1024);
  console.log(
    `[bundle-offline] ✓ Saved ${slimTracks.length} tracks (${jsonKb} KB) | With full lyrics: ${withFullLyrics} | Bundled covers: ${bundledCovers}`
  );
}

main().catch((err) => {
  console.warn('[bundle-offline] Non-fatal warning:', err?.message || err);
});
