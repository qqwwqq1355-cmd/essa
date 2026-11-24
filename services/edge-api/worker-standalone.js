/**
 * مكتبة عيسى الليث — Cloudflare Worker (بث فائق السرعة عبر GitHub Releases CDN — صفر 429!)
 *
 * المتطلبات في إعدادات الـ Worker بلوحة Cloudflare (Settings):
 *  - Bindings -> D1 database: DB -> essa-alleth-db
 *  - (اختياري للمستودعات الخاصة فقط) Secret: GITHUB_TOKEN
 */

const PALETTE_PRESETS = [
  { primary: '#1E2A38', secondary: '#0F151D', accent: '#E2A84B', pattern: 'geometric' },
  { primary: '#16302B', secondary: '#0B1916', accent: '#35C996', pattern: 'arch' },
  { primary: '#2D1F2D', secondary: '#140E16', accent: '#E59A6B', pattern: 'stars' },
  { primary: '#25213B', secondary: '#100E1B', accent: '#9B8CFF', pattern: 'waves' },
  { primary: '#332418', secondary: '#160F09', accent: '#F0B35B', pattern: 'geometric' },
  { primary: '#182C3A', secondary: '#0B141C', accent: '#4DB8E8', pattern: 'waves' },
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, X-App-Client',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
};

let schemaInitialized = false;

async function ensureSchema(db) {
  if (schemaInitialized) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      source_channel TEXT NOT NULL DEFAULT 'IssaAllaith',
      source_message_id INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      title_normalized TEXT NOT NULL,
      poet TEXT,
      category TEXT NOT NULL DEFAULT 'زوامل',
      duration_sec INTEGER NOT NULL DEFAULT 0,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
      storage_provider TEXT NOT NULL DEFAULT 'github',
      telegram_file_id TEXT,
      telegram_archive_msg_id INTEGER,
      r2_object_key TEXT,
      cover_url TEXT,
      published_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      play_count INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS track_lyrics (
      track_id TEXT PRIMARY KEY,
      lyrics_raw TEXT NOT NULL,
      lyrics_normalized TEXT NOT NULL,
      lyrics_message_id INTEGER,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sync_state (
      channel_username TEXT PRIMARY KEY,
      last_message_id INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT NOT NULL,
      total_synced INTEGER NOT NULL DEFAULT 0,
      last_status TEXT NOT NULL DEFAULT 'ok',
      last_error TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tracks_published ON tracks(published_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tracks_updated ON tracks(updated_at ASC)`),
    db.prepare(
      `INSERT OR IGNORE INTO sync_state (channel_username, last_message_id, last_run_at, total_synced, last_status)
       VALUES ('IssaAllaith', 0, datetime('now'), 0, 'pending_initial_sync')`
    ),
  ]);
  schemaInitialized = true;
}

function getPalette(seed) {
  return PALETTE_PRESETS[Math.abs(Number(seed) || 0) % PALETTE_PRESETS.length];
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function mapRowToTrack(row, origin) {
  return {
    id: row.id,
    sourceChannel: row.source_channel || 'IssaAllaith',
    sourceMessageId: row.source_message_id,
    title: row.title,
    titleNormalized: row.title_normalized,
    poet: row.poet ?? null,
    category: row.category || 'زوامل',
    durationSec: row.duration_sec || 0,
    fileSizeBytes: row.file_size_bytes || 0,
    mimeType: row.mime_type || 'audio/mpeg',
    storageProvider: row.storage_provider || 'github',
    streamUrl: `${origin}/v1/tracks/${encodeURIComponent(row.id)}/stream?v=${encodeURIComponent(row.updated_at || '1')}`,
    coverUrl: row.cover_url ?? null,
    palette: getPalette(row.source_message_id),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    hasLyrics: Boolean(row.lyrics_raw),
    lyrics: row.lyrics_raw ?? null,
    lyricsNormalized: row.lyrics_normalized ?? null,
    playCount: row.play_count || 0,
    isDeleted: row.is_deleted === 1,
  };
}

// كاش مؤقت لروابط التحميل الموقّعة من GitHub (يختصر تحويل 302 في كل قطعة بث!)
const signedRedirectCache = new Map(); // audioUrl -> { url, expiresAt }

async function resolveGitHubDirectAssetUrl(audioUrl, env, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh) {
    const cached = signedRedirectCache.get(audioUrl);
    if (cached && cached.expiresAt > now) {
      return cached.url;
    }
  }

  const headers = new Headers({ 'User-Agent': 'essa-alleth-edge-api' });
  if (env.GITHUB_TOKEN && audioUrl.includes('github.com')) {
    headers.set('Authorization', `Bearer ${env.GITHUB_TOKEN}`);
  }

  const probe = await fetch(audioUrl, { headers, redirect: 'manual' });
  const loc = probe.headers.get('Location');
  if (loc && (probe.status === 301 || probe.status === 302 || probe.status === 307 || probe.status === 308)) {
    signedRedirectCache.set(audioUrl, { url: loc, expiresAt: now + 120_000 }); // دقيقتان
    return loc;
  }
  return audioUrl;
}

/**
 * يحوّل طلبات Range المفتوحة (bytes=0-) إلى قطع بث سريعة (256KB للبدء الفوري، ثم 512KB)
 * تماماً مثل YouTube و Spotify حتى يبدأ تشغيل الصوت خلال أقل من نصف ثانية دون انتظار تحميل كامل الملف!
 */
function buildChunkedRangeHeader(rangeHeader) {
  if (!rangeHeader) return null;
  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) return rangeHeader;

  const start = Number(match[1]);
  const rawEnd = match[2];

  // إذا حدّد المتصفح نهاية صغيرة صريحة (أقل من 1MB) نحترمها كما هي
  if (rawEnd) {
    const end = Number(rawEnd);
    if (end >= start && end - start <= 1048576) {
      return `bytes=${start}-${end}`;
    }
  }

  // أول قطعة 64KB لبدء التشغيل الفوري خلال ثانية، والقطع التالية 256KB لتدفق ناعم حتى على النت الضعيف
  const chunkSize = start === 0 ? 65536 : 262144;
  const cappedEnd = start + chunkSize - 1;
  return `bytes=${start}-${cappedEnd}`;
}

/**
 * يبث ملف الـ MP3 بتدفق فوري متدرج (Progressive Chunked HTTP 206 Streaming)
 */
async function streamFromDirectUrl(audioUrl, mimeType, rangeHeader, env) {
  const effectiveRange = buildChunkedRangeHeader(rangeHeader);
  let targetUrl = audioUrl.includes('github.com')
    ? await resolveGitHubDirectAssetUrl(audioUrl, env, false)
    : audioUrl;

  const doFetch = async (urlToFetch, range) => {
    const h = new Headers({ 'User-Agent': 'essa-alleth-edge-api' });
    if (range) h.set('Range', range);
    return fetch(urlToFetch, { headers: h, redirect: 'follow' });
  };

  let upstream = await doFetch(targetUrl, effectiveRange);

  // إذا انتهت صلاحية رابط GitHub الموقّع المخزن في الكاش نعيد حله مرة واحدة فوراً
  if ((upstream.status === 403 || upstream.status === 404) && audioUrl.includes('github.com')) {
    targetUrl = await resolveGitHubDirectAssetUrl(audioUrl, env, true);
    upstream = await doFetch(targetUrl, effectiveRange);
  }

  // في حال كان الملف أصغر من نطاق الكتلة نعيد الطلب بنطاق المتصفح الأصلي
  if (upstream.status === 416 && effectiveRange !== rangeHeader) {
    upstream = await doFetch(targetUrl, rangeHeader);
  }

  if (!upstream.ok && upstream.status !== 206) {
    return jsonResponse(
      { error: `Audio CDN returned HTTP ${upstream.status}`, audioUrl },
      502
    );
  }

  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', mimeType || 'audio/mpeg');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=86400');

  const contentLength = upstream.headers.get('Content-Length');
  const contentRange = upstream.headers.get('Content-Range');
  if (contentLength) headers.set('Content-Length', contentLength);
  if (contentRange) headers.set('Content-Range', contentRange);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

async function streamFromTelegram(env, telegramFileId, mimeType, rangeHeader) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return jsonResponse({ error: 'TELEGRAM_BOT_TOKEN is not configured.' }, 503);
  }
  const getFileUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(telegramFileId)}`;
  const metaRes = await fetch(getFileUrl, { cf: { cacheTtl: 1800, cacheEverything: true } });
  const meta = await metaRes.json();
  if (!metaRes.ok || !meta.ok || !meta.result?.file_path) {
    return jsonResponse({ error: 'Telegram file_path unavailable.', details: meta.description }, 502);
  }
  const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${meta.result.file_path}`;
  return streamFromDirectUrl(fileUrl, mimeType, rangeHeader, {});
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';
      const origin = url.origin;
      const channelName = env.SOURCE_CHANNEL_USERNAME || 'IssaAllaith';

      if (!env.DB) {
        return jsonResponse({ error: 'D1 Binding "DB" is missing in Worker Settings.' }, 500);
      }

      await ensureSchema(env.DB);

      // 1) فحص الصحة
      if (pathname === '/' || pathname === '/v1/health') {
        const syncRow = await env.DB.prepare(
          `SELECT last_run_at, total_synced, last_status FROM sync_state WHERE channel_username = ? LIMIT 1`
        )
          .bind(channelName)
          .first();

        const countRow = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM tracks WHERE is_deleted = 0`
        ).first();

        const playableRow = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM tracks
           WHERE is_deleted = 0
             AND ((r2_object_key IS NOT NULL AND r2_object_key != '') OR (telegram_file_id IS NOT NULL AND telegram_file_id != ''))`
        ).first();

        return jsonResponse({
          status: syncRow?.last_status === 'error' ? 'degraded' : 'ok',
          service: 'essa-alleth-edge-api',
          sourceChannel: channelName,
          storageMode: 'github',
          lastSyncAt: syncRow?.last_run_at ?? null,
          totalTracks: countRow?.count ?? 0,
          playableTracks: playableRow?.count ?? 0,
          timestamp: new Date().toISOString(),
        });
      }

      // 2) المزامنة التفاضلية الكاملة (جميع المقاطع عبر الصفحات)
      if (pathname === '/v1/sync') {
        const since = url.searchParams.get('since') || '1970-01-01T00:00:00.000Z';
        const limit = Math.min(500, Math.max(10, Number(url.searchParams.get('limit') || 250)));
        const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));

        const { results } = await env.DB.prepare(
          `SELECT t.*, l.lyrics_raw, l.lyrics_normalized
           FROM tracks t
           LEFT JOIN track_lyrics l ON l.track_id = t.id
           WHERE t.updated_at > ? AND t.is_deleted = 0
           ORDER BY t.published_at DESC
           LIMIT ? OFFSET ?`
        )
          .bind(since, limit + 1, offset)
          .all();

        const hasMore = results.length > limit;
        const sliced = hasMore ? results.slice(0, limit) : results;
        const tracks = sliced.map((r) => mapRowToTrack(r, origin));

        const countRow = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM tracks WHERE is_deleted = 0`
        ).first();

        return jsonResponse(
          {
            serverTime: new Date().toISOString(),
            sourceChannel: channelName,
            hasMore,
            nextCursor: hasMore ? String(offset + limit) : null,
            totalCount: countRow?.count ?? tracks.length,
            tracks,
          },
          200,
          { 'Cache-Control': 'public, max-age=30' }
        );
      }

      // 3) قائمة المقاطع
      if (pathname === '/v1/tracks') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const limit = Math.min(100, Math.max(10, Number(url.searchParams.get('limit') || 30)));
        const category = url.searchParams.get('category');
        const offset = (page - 1) * limit;

        const sql = category
          ? `SELECT t.*, l.lyrics_raw, l.lyrics_normalized
             FROM tracks t LEFT JOIN track_lyrics l ON l.track_id = t.id
             WHERE t.is_deleted = 0 AND t.category = ?
             ORDER BY t.published_at DESC LIMIT ? OFFSET ?`
          : `SELECT t.*, l.lyrics_raw, l.lyrics_normalized
             FROM tracks t LEFT JOIN track_lyrics l ON l.track_id = t.id
             WHERE t.is_deleted = 0
             ORDER BY t.published_at DESC LIMIT ? OFFSET ?`;

        const stmt = category
          ? env.DB.prepare(sql).bind(category, limit, offset)
          : env.DB.prepare(sql).bind(limit, offset);

        const { results } = await stmt.all();
        return jsonResponse(
          { page, limit, tracks: results.map((r) => mapRowToTrack(r, origin)) },
          200,
          { 'Cache-Control': 'public, max-age=120' }
        );
      }

      // 4) بث/تحميل MP3 بـ HTTP 206 Range Requests من GitHub Releases CDN (أو Telegram)
      const streamMatch = pathname.match(/^\/v1\/tracks\/([^/]+)\/stream$/);
      if (streamMatch) {
        const id = decodeURIComponent(streamMatch[1]);
        const rangeHeader = request.headers.get('Range');

        const row = await env.DB.prepare(
          `SELECT id, mime_type, storage_provider, r2_object_key, telegram_file_id
           FROM tracks WHERE id = ? AND is_deleted = 0 LIMIT 1`
        )
          .bind(id)
          .first();

        if (!row) {
          return jsonResponse({ error: 'Track not found' }, 404);
        }

        if (!rangeHeader || rangeHeader.startsWith('bytes=0-')) {
          ctx.waitUntil(
            env.DB.prepare(`UPDATE tracks SET play_count = play_count + 1 WHERE id = ?`).bind(id).run()
          );
        }

        // 1) الأولوية لبث GitHub Releases CDN (سريع جداً وصفر 429!)
        if (row.r2_object_key && row.r2_object_key.startsWith('http')) {
          return streamFromDirectUrl(row.r2_object_key, row.mime_type, rangeHeader, env);
        }

        // 2) بديل: Telegram file_id إن وُجد
        if (row.telegram_file_id) {
          return streamFromTelegram(env, row.telegram_file_id, row.mime_type, rangeHeader);
        }

        return jsonResponse(
          {
            error: 'Audio MP3 is still syncing to GitHub Releases.',
            hint: 'Run the GitHub Actions "Automated Telegram Sync" workflow with mode=backfill to upload all MP3s automatically.',
          },
          404
        );
      }

      // 5) تفاصيل مقطع محدد
      const trackMatch = pathname.match(/^\/v1\/tracks\/([^/]+)$/);
      if (trackMatch) {
        const id = decodeURIComponent(trackMatch[1]);
        const row = await env.DB.prepare(
          `SELECT t.*, l.lyrics_raw, l.lyrics_normalized
           FROM tracks t LEFT JOIN track_lyrics l ON l.track_id = t.id
           WHERE t.id = ? AND t.is_deleted = 0 LIMIT 1`
        )
          .bind(id)
          .first();

        if (!row) {
          return jsonResponse({ error: 'Track not found' }, 404);
        }

        return jsonResponse(mapRowToTrack(row, origin), 200, { 'Cache-Control': 'public, max-age=300' });
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (err) {
      return jsonResponse(
        {
          error: 'Worker runtime error',
          details: err instanceof Error ? err.message : String(err),
        },
        500
      );
    }
  },
};
