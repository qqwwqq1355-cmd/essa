-- ============================================================================
-- مكتبة عيسى الليث — مخطط قاعدة البيانات السحابية (Cloudflare D1 / SQLite)
-- Migration: 0001_initial_schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,                          -- مثال: tg_4821
    source_channel TEXT NOT NULL DEFAULT 'IssaAllaith',
    source_message_id INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    title_normalized TEXT NOT NULL,
    poet TEXT,
    category TEXT NOT NULL DEFAULT 'زوامل',
    duration_sec INTEGER NOT NULL DEFAULT 0,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
    storage_provider TEXT NOT NULL DEFAULT 'telegram', -- 'telegram' | 'r2'
    telegram_file_id TEXT,                        -- file_id من البوت في قناة الأرشيف
    telegram_archive_msg_id INTEGER,
    r2_object_key TEXT,
    cover_url TEXT,
    published_at TEXT NOT NULL,                   -- ISO-8601
    updated_at TEXT NOT NULL,                     -- ISO-8601 (للمزامنة التفاضلية)
    play_count INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS track_lyrics (
    track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    lyrics_raw TEXT NOT NULL,
    lyrics_normalized TEXT NOT NULL,
    lyrics_message_id INTEGER,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
    channel_username TEXT PRIMARY KEY,
    last_message_id INTEGER NOT NULL DEFAULT 0,
    last_run_at TEXT NOT NULL,
    total_synced INTEGER NOT NULL DEFAULT 0,
    last_status TEXT NOT NULL DEFAULT 'ok',
    last_error TEXT
);

-- فهارس الأداء العالي للقوائم والمزامنة التفاضلية
CREATE INDEX IF NOT EXISTS idx_tracks_published ON tracks(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_updated ON tracks(updated_at ASC);
CREATE INDEX IF NOT EXISTS idx_tracks_category ON tracks(category);
CREATE INDEX IF NOT EXISTS idx_tracks_deleted ON tracks(is_deleted);

-- فهرس البحث النصي العربي السريع (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
    track_id UNINDEXED,
    title_normalized,
    poet_normalized,
    lyrics_normalized
);

-- تهيئة سجل المزامنة الافتراضي للقناة الرسمية
INSERT OR IGNORE INTO sync_state (channel_username, last_message_id, last_run_at, total_synced, last_status)
VALUES ('IssaAllaith', 0, datetime('now'), 0, 'pending_initial_sync');

