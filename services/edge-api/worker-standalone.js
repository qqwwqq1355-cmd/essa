/**
 * مكتبة عيسى الليث — Cloudflare Worker (بث فوري مباشر من Cloudflare R2 + D1)
 *
 * المتطلبات في إعدادات الـ Worker بلوحة Cloudflare (Settings):
 *  1) Bindings -> D1 database:   DB           -> essa-alleth-db
 *  2) Bindings -> R2 bucket:     AUDIO_BUCKET -> essa-alleth-audio
 *  3) Runtime variables & secrets -> Secret:
 *       R2_UPLOAD_SECRET = نفس قيمة CLOUDFLARE_API_TOKEN (أو سر مشترك مع GitHub Secrets)
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
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization, X-App-Client',
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
      storage_provider TEXT NOT NULL DEFAULT 'r2',
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
    storageProvider: row.storage_provider || 'r2',
    streamUrl: `${origin}/v1/tracks/${encodeURIComponent(row.id)}/stream?v=${encodeURIComponent(row.updated_at || '1')}`,
    coverUrl:
      row.cover_url && row.cover_url.startsWith('covers/')
        ? `${origin}/v1/tracks/${encodeURIComponent(row.id)}/cover`
        : row.cover_url ?? null,
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

/**
 * بث مباشر فوري من Cloudflare R2 مع دعم كامل لـ HTTP 206 Partial Content و HEAD
 */
async function streamFromR2Bucket(bucket, objectKey, mimeType, request) {
  const rangeHeader = request.headers.get('Range');

  if (request.method === 'HEAD') {
    const headObj = await bucket.head(objectKey);
    if (!headObj) return new Response(null, { status: 404, headers: CORS_HEADERS });
    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', mimeType || 'audio/mpeg');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(headObj.size));
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(null, { status: 200, headers });
  }

  const object = rangeHeader
    ? await bucket.get(objectKey, { range: request.headers })
    : await bucket.get(objectKey);

  if (!object) {
    return jsonResponse({ error: 'Audio object not found in Cloudflare R2.', key: objectKey }, 404);
  }

  const headers = new Headers(CORS_HEADERS);
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', mimeType || 'audio/mpeg');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  const isPartial = Boolean(rangeHeader && object.range);
  if (isPartial) {
    let start = 0;
    let length = object.size;
    if ('suffix' in object.range && typeof object.range.suffix === 'number') {
      length = Math.min(object.range.suffix, object.size);
      start = object.size - length;
    } else {
      start = object.range.offset ?? 0;
      length = object.range.length ?? (object.size - start);
    }
    const end = Math.max(start, start + length - 1);
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', String(length));
  } else {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(object.body, {
    status: isPartial ? 206 : 200,
    headers,
  });
}

// بديل للمقاطع القديمة التي ما زالت على GitHub قبل إتمام انتقالها إلى R2
async function streamFromDirectUrl(audioUrl, mimeType, rangeHeader) {
  const h = new Headers({ 'User-Agent': 'essa-alleth-edge-api' });
  if (rangeHeader) h.set('Range', rangeHeader);
  const upstream = await fetch(audioUrl, {
    headers: h,
    redirect: 'follow',
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  if (!upstream.ok && upstream.status !== 206) {
    return jsonResponse({ error: `Fallback CDN returned HTTP ${upstream.status}` }, 502);
  }
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', mimeType || 'audio/mpeg');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=86400');
  const cl = upstream.headers.get('Content-Length');
  const cr = upstream.headers.get('Content-Range');
  if (cl) headers.set('Content-Length', cl);
  if (cr) headers.set('Content-Range', cr);
  return new Response(upstream.body, { status: upstream.status, headers });
}

function isAuthorizedUploader(request, env) {
  const expected = (env.R2_UPLOAD_SECRET || '').trim();
  if (!expected) return false;
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${expected}`;
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

      // 0) نقطة الرفع الداخلية المحمية إلى Cloudflare R2 (يستدعيها محرك GitHub Actions فقط!)
      const r2UploadMatch = pathname.match(/^\/v1\/internal\/r2\/(.+)$/);
      if (r2UploadMatch) {
        if (!env.AUDIO_BUCKET) {
          return jsonResponse({ error: 'R2 Binding "AUDIO_BUCKET" is missing in Worker Settings.' }, 503);
        }
        if (!isAuthorizedUploader(request, env)) {
          return jsonResponse({ error: 'Unauthorized R2 upload request.' }, 401);
        }

        const key = decodeURIComponent(r2UploadMatch[1]);

        if (request.method === 'HEAD') {
          const exists = await env.AUDIO_BUCKET.head(key);
          if (!exists) return new Response(null, { status: 404, headers: CORS_HEADERS });
          return new Response(null, {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Length': String(exists.size) },
          });
        }

        if (request.method === 'PUT') {
          const obj = await env.AUDIO_BUCKET.put(key, request.body, {
            httpMetadata: {
              contentType: request.headers.get('Content-Type') || 'audio/mpeg',
              cacheControl: 'public, max-age=31536000, immutable',
            },
          });
          return jsonResponse({ ok: true, key: obj.key, sizeBytes: obj.size }, 200);
        }

        return jsonResponse({ error: 'Method Not Allowed' }, 405);
      }

      if (!env.DB) {
        return jsonResponse({ error: 'D1 Binding "DB" is missing in Worker Settings.' }, 500);
      }

      await ensureSchema(env.DB);

      // 1) فحص الصحة وحالة ربط R2
      if (pathname === '/' || pathname === '/v1/health') {
        const syncRow = await env.DB.prepare(
          `SELECT last_run_at, total_synced, last_status FROM sync_state WHERE channel_username = ? LIMIT 1`
        )
          .bind(channelName)
          .first();

        const countRow = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM tracks WHERE is_deleted = 0`
        ).first();

        const r2CountRow = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM tracks
           WHERE is_deleted = 0 AND storage_provider = 'r2' AND r2_object_key LIKE 'audio/%'`
        ).first();

        return jsonResponse({
          status: syncRow?.last_status === 'error' ? 'degraded' : 'ok',
          service: 'essa-alleth-edge-api',
          sourceChannel: channelName,
          storageMode: 'r2',
          r2BucketBound: Boolean(env.AUDIO_BUCKET),
          r2UploadSecretConfigured: Boolean(env.R2_UPLOAD_SECRET),
          lastSyncAt: syncRow?.last_run_at ?? null,
          totalTracks: countRow?.count ?? 0,
          r2ReadyTracks: r2CountRow?.count ?? 0,
          timestamp: new Date().toISOString(),
        });
      }

      // 2) المزامنة التفاضلية الكاملة
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

      // 4) بث فوري مباشر من Cloudflare R2 (مع دعم المقاطع القديمة مؤقتاً حتى اكتمال النقل)
      const streamMatch = pathname.match(/^\/v1\/tracks\/([^/]+)\/stream$/);
      if (streamMatch) {
        const id = decodeURIComponent(streamMatch[1]);
        const rangeHeader = request.headers.get('Range');

        const row = await env.DB.prepare(
          `SELECT id, mime_type, storage_provider, r2_object_key
           FROM tracks WHERE id = ? AND is_deleted = 0 LIMIT 1`
        )
          .bind(id)
          .first();

        if (!row) {
          return jsonResponse({ error: 'Track not found' }, 404);
        }

        if (request.method === 'GET' && (!rangeHeader || rangeHeader.startsWith('bytes=0-'))) {
          ctx.waitUntil(
            env.DB.prepare(`UPDATE tracks SET play_count = play_count + 1 WHERE id = ?`).bind(id).run()
          );
        }

        // 1) بث مباشر فوري من Cloudflare R2
        if (row.storage_provider === 'r2' && row.r2_object_key && env.AUDIO_BUCKET) {
          return streamFromR2Bucket(env.AUDIO_BUCKET, row.r2_object_key, row.mime_type, request);
        }

        // 2) انتقال سلس: أي مقطع لم ينتقل بعد يواصل العمل مؤقتاً من رابطه القديم
        if (row.r2_object_key && row.r2_object_key.startsWith('http')) {
          return streamFromDirectUrl(row.r2_object_key, row.mime_type, rangeHeader);
        }

        return jsonResponse({ error: 'Audio MP3 is currently syncing to Cloudflare R2.' }, 404);
      }

      // 4.5) تقديم صورة غلاف الزامل المصغّرة من Cloudflare R2
      const coverMatch = pathname.match(/^\/v1\/tracks\/([^/]+)\/cover$/);
      if (coverMatch) {
        const id = decodeURIComponent(coverMatch[1]);
        const row = await env.DB.prepare(
          `SELECT cover_url FROM tracks WHERE id = ? AND is_deleted = 0 LIMIT 1`
        )
          .bind(id)
          .first();

        if (!row?.cover_url || !env.AUDIO_BUCKET) {
          return new Response(null, { status: 404, headers: CORS_HEADERS });
        }

        const obj = await env.AUDIO_BUCKET.get(row.cover_url);
        if (!obj) {
          return new Response(null, { status: 404, headers: CORS_HEADERS });
        }

        const headers = new Headers(CORS_HEADERS);
        headers.set('Content-Type', 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(obj.body, { status: 200, headers });
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
