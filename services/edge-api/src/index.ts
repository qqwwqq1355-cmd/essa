import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { DbTrackRow, EdgeEnv } from './types';
import { streamFromR2, streamFromTelegram } from './providers/telegramStream';
import { getDeterministicPalette } from '../../../packages/shared/src/arabic/lyricsParser';

const app = new Hono<{ Bindings: EdgeEnv }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Range', 'X-App-Client'],
    exposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag'],
  })
);

function mapRowToTrack(row: DbTrackRow, origin: string) {
  return {
    id: row.id,
    sourceChannel: row.source_channel,
    sourceMessageId: row.source_message_id,
    title: row.title,
    titleNormalized: row.title_normalized,
    poet: row.poet,
    category: row.category,
    durationSec: row.duration_sec,
    fileSizeBytes: row.file_size_bytes,
    mimeType: row.mime_type,
    storageProvider: row.storage_provider,
    streamUrl: `${origin}/v1/tracks/${encodeURIComponent(row.id)}/stream`,
    coverUrl: row.cover_url,
    palette: getDeterministicPalette(row.source_message_id),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    hasLyrics: Boolean(row.lyrics_raw),
    lyrics: row.lyrics_raw ?? null,
    lyricsNormalized: row.lyrics_normalized ?? null,
    playCount: row.play_count,
    isDeleted: row.is_deleted === 1,
  };
}

app.get('/v1/health', async (c) => {
  const syncRow = await c.env.DB.prepare(
    `SELECT last_run_at, total_synced, last_status FROM sync_state WHERE channel_username = ? LIMIT 1`
  )
    .bind(c.env.SOURCE_CHANNEL_USERNAME || 'IssaAllaith')
    .first<{ last_run_at: string; total_synced: number; last_status: string }>();

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM tracks WHERE is_deleted = 0`
  ).first<{ count: number }>();

  return c.json({
    status: syncRow?.last_status === 'error' ? 'degraded' : 'ok',
    service: 'essa-alleth-edge-api',
    sourceChannel: c.env.SOURCE_CHANNEL_USERNAME || 'IssaAllaith',
    storageMode: c.env.STORAGE_MODE || 'telegram',
    lastSyncAt: syncRow?.last_run_at ?? null,
    totalTracks: countRow?.count ?? 0,
    timestamp: new Date().toISOString(),
  });
});

// المزامنة التفاضلية السريعة (Delta Sync)
app.get('/v1/sync', async (c) => {
  const since = c.req.query('since') || '1970-01-01T00:00:00.000Z';
  const limit = Math.min(200, Math.max(10, Number(c.req.query('limit') || 100)));
  const origin = new URL(c.req.url).origin;

  const { results } = await c.env.DB.prepare(
    `SELECT t.*, l.lyrics_raw, l.lyrics_normalized
     FROM tracks t
     LEFT JOIN track_lyrics l ON l.track_id = t.id
     WHERE t.updated_at > ?
     ORDER BY t.published_at DESC
     LIMIT ?`
  )
    .bind(since, limit + 1)
    .all<DbTrackRow>();

  const hasMore = results.length > limit;
  const sliced = hasMore ? results.slice(0, limit) : results;
  const tracks = sliced.map((row) => mapRowToTrack(row, origin));

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM tracks WHERE is_deleted = 0`
  ).first<{ count: number }>();

  c.header('Cache-Control', 'public, max-age=60');
  return c.json({
    serverTime: new Date().toISOString(),
    sourceChannel: c.env.SOURCE_CHANNEL_USERNAME || 'IssaAllaith',
    hasMore,
    nextCursor: hasMore ? sliced[sliced.length - 1].updated_at : null,
    totalCount: countRow?.count ?? tracks.length,
    tracks,
  });
});

// قائمة المقاطع مع ترقيم الصفحات
app.get('/v1/tracks', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') || 1));
  const limit = Math.min(100, Math.max(10, Number(c.req.query('limit') || 30)));
  const category = c.req.query('category');
  const offset = (page - 1) * limit;
  const origin = new URL(c.req.url).origin;

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
    ? c.env.DB.prepare(sql).bind(category, limit, offset)
    : c.env.DB.prepare(sql).bind(limit, offset);

  const { results } = await stmt.all<DbTrackRow>();
  c.header('Cache-Control', 'public, max-age=120');
  return c.json({
    page,
    limit,
    tracks: results.map((r) => mapRowToTrack(r, origin)),
  });
});

// تفاصيل مقطع محدد مع كلماته
app.get('/v1/tracks/:id', async (c) => {
  const id = c.req.param('id');
  const origin = new URL(c.req.url).origin;

  const row = await c.env.DB.prepare(
    `SELECT t.*, l.lyrics_raw, l.lyrics_normalized
     FROM tracks t LEFT JOIN track_lyrics l ON l.track_id = t.id
     WHERE t.id = ? AND t.is_deleted = 0 LIMIT 1`
  )
    .bind(id)
    .first<DbTrackRow>();

  if (!row) {
    return c.json({ error: 'Track not found' }, 404);
  }

  c.header('Cache-Control', 'public, max-age=300');
  return c.json(mapRowToTrack(row, origin));
});

// بث/تحميل ملف MP3 مع دعم Range Requests (206)
app.get('/v1/tracks/:id/stream', async (c) => {
  const id = c.req.param('id');
  const rangeHeader = c.req.header('Range') || null;

  const row = await c.env.DB.prepare(
    `SELECT id, mime_type, storage_provider, telegram_file_id, r2_object_key
     FROM tracks WHERE id = ? AND is_deleted = 0 LIMIT 1`
  )
    .bind(id)
    .first<Pick<DbTrackRow, 'id' | 'mime_type' | 'storage_provider' | 'telegram_file_id' | 'r2_object_key'>>();

  if (!row) {
    return c.json({ error: 'Track not found' }, 404);
  }

  // زيادة عداد الاستماع في الخلفية بدون تأخير البث
  if (!rangeHeader || rangeHeader.startsWith('bytes=0-')) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare(`UPDATE tracks SET play_count = play_count + 1 WHERE id = ?`).bind(id).run()
    );
  }

  if (row.storage_provider === 'r2' && row.r2_object_key && c.env.AUDIO_BUCKET) {
    return streamFromR2(c.env.AUDIO_BUCKET, row.r2_object_key, row.mime_type, rangeHeader);
  }

  if (row.telegram_file_id) {
    return streamFromTelegram(c.env, row.telegram_file_id, row.mime_type, rangeHeader);
  }

  return c.json({ error: 'Audio source not archived yet for this track.' }, 404);
});

export default app;

