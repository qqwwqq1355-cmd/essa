import type { SyncConfig } from './config';

interface D1QueryResult<T = Record<string, unknown>> {
  success: boolean;
  result: Array<{
    results: T[];
    success: boolean;
  }>;
  errors?: Array<{ message: string }>;
}

export interface TrackUpsertInput {
  id: string;
  sourceChannel: string;
  sourceMessageId: number;
  title: string;
  titleNormalized: string;
  poet: string | null;
  poetNormalized: string;
  category: string;
  durationSec: number;
  fileSizeBytes: number;
  mimeType: string;
  storageProvider: 'github' | 'telegram' | 'r2';
  telegramFileId: string | null;
  telegramArchiveMsgId: number | null;
  r2ObjectKey: string | null;
  publishedAt: string;
  lyricsRaw: string | null;
  lyricsNormalized: string;
  lyricsMessageId: number | null;
}

export class CloudflareD1SyncClient {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;

  constructor(config: SyncConfig) {
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/d1/database/${config.cloudflareD1DatabaseId}/query`;
    this.headers = {
      Authorization: `Bearer ${config.cloudflareApiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ sql, params }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare D1 HTTP ${res.status}: ${text}`);
    }

    const data = (await res.json()) as D1QueryResult<T>;
    if (!data.success) {
      const errMsg = data.errors?.map((e) => e.message).join('; ') || 'Unknown D1 error';
      throw new Error(`Cloudflare D1 query failed: ${errMsg}`);
    }

    return data.result?.[0]?.results ?? [];
  }

  async getLastMessageId(channelUsername: string): Promise<number> {
    const rows = await this.query<{ last_message_id: number }>(
      `SELECT last_message_id FROM sync_state WHERE channel_username = ? LIMIT 1`,
      [channelUsername]
    );
    return rows[0]?.last_message_id ?? 0;
  }

  async getExistingSourceMessageIds(
    channelUsername: string,
    storageMode: 'github' | 'telegram' | 'r2' = 'github'
  ): Promise<Set<number>> {
    if (storageMode === 'github') {
      // في وضع GitHub نتخطى فقط المقاطع التي تم رفع ملف MP3 الخاص بها إلى GitHub Releases
      const rows = await this.query<{ source_message_id: number }>(
        `SELECT source_message_id FROM tracks
         WHERE source_channel = ? AND is_deleted = 0
           AND storage_provider = 'github'
           AND r2_object_key IS NOT NULL AND r2_object_key != ''`,
        [channelUsername]
      );
      return new Set(rows.map((r) => Number(r.source_message_id)));
    }

    const rows = await this.query<{ source_message_id: number }>(
      `SELECT t.source_message_id FROM tracks t
       LEFT JOIN archive_files a ON a.archive_msg_id = t.telegram_archive_msg_id
       WHERE t.source_channel = ? AND t.is_deleted = 0
         AND ((t.telegram_file_id IS NOT NULL AND t.telegram_file_id != '') OR a.file_id IS NOT NULL)`,
      [channelUsername]
    );
    return new Set(rows.map((r) => Number(r.source_message_id)));
  }

  async upsertTrack(track: TrackUpsertInput): Promise<void> {
    const now = new Date().toISOString();

    await this.query(
      `INSERT INTO tracks (
        id, source_channel, source_message_id, title, title_normalized, poet,
        category, duration_sec, file_size_bytes, mime_type, storage_provider,
        telegram_file_id, telegram_archive_msg_id, r2_object_key,
        published_at, updated_at, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(source_message_id) DO UPDATE SET
        title = excluded.title,
        title_normalized = excluded.title_normalized,
        poet = COALESCE(excluded.poet, tracks.poet),
        category = excluded.category,
        duration_sec = CASE WHEN excluded.duration_sec > 0 THEN excluded.duration_sec ELSE tracks.duration_sec END,
        file_size_bytes = CASE WHEN excluded.file_size_bytes > 0 THEN excluded.file_size_bytes ELSE tracks.file_size_bytes END,
        storage_provider = excluded.storage_provider,
        telegram_file_id = COALESCE(excluded.telegram_file_id, tracks.telegram_file_id),
        telegram_archive_msg_id = COALESCE(excluded.telegram_archive_msg_id, tracks.telegram_archive_msg_id),
        r2_object_key = COALESCE(excluded.r2_object_key, tracks.r2_object_key),
        updated_at = excluded.updated_at`,
      [
        track.id,
        track.sourceChannel,
        track.sourceMessageId,
        track.title,
        track.titleNormalized,
        track.poet,
        track.category,
        track.durationSec,
        track.fileSizeBytes,
        track.mimeType,
        track.storageProvider,
        track.telegramFileId,
        track.telegramArchiveMsgId,
        track.r2ObjectKey,
        track.publishedAt,
        now,
      ]
    );

    if (track.lyricsRaw) {
      await this.query(
        `INSERT INTO track_lyrics (track_id, lyrics_raw, lyrics_normalized, lyrics_message_id, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(track_id) DO UPDATE SET
           lyrics_raw = excluded.lyrics_raw,
           lyrics_normalized = excluded.lyrics_normalized,
           lyrics_message_id = COALESCE(excluded.lyrics_message_id, track_lyrics.lyrics_message_id),
           updated_at = excluded.updated_at`,
        [track.id, track.lyricsRaw, track.lyricsNormalized, track.lyricsMessageId, now]
      );
    }

    // تحديث فهرس البحث FTS5 (اختياري — لا يوقف المزامنة إذا لم يكن الجدول الافتراضي مفعّلاً)
    await this.query(`DELETE FROM tracks_fts WHERE track_id = ?`, [track.id]).catch(() => undefined);
    await this.query(
      `INSERT INTO tracks_fts (track_id, title_normalized, poet_normalized, lyrics_normalized)
       VALUES (?, ?, ?, ?)`,
      [track.id, track.titleNormalized, track.poetNormalized, track.lyricsNormalized]
    ).catch(() => undefined);
  }

  async updateSyncState(
    channelUsername: string,
    lastMessageId: number,
    newlySyncedCount: number,
    status: 'ok' | 'error' = 'ok',
    lastError: string | null = null
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.query(
      `INSERT INTO sync_state (channel_username, last_message_id, last_run_at, total_synced, last_status, last_error)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_username) DO UPDATE SET
         last_message_id = MAX(sync_state.last_message_id, excluded.last_message_id),
         last_run_at = excluded.last_run_at,
         total_synced = sync_state.total_synced + excluded.total_synced,
         last_status = excluded.last_status,
         last_error = excluded.last_error`,
      [channelUsername, lastMessageId, now, newlySyncedCount, status, lastError]
    );
  }
}

