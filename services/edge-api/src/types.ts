export interface EdgeEnv {
  DB: D1Database;
  AUDIO_BUCKET?: R2Bucket;
  TELEGRAM_BOT_TOKEN: string;
  SOURCE_CHANNEL_USERNAME: string;
  STORAGE_MODE: 'telegram' | 'r2';
  API_APP_SECRET?: string;
}

export interface DbTrackRow {
  id: string;
  source_channel: string;
  source_message_id: number;
  title: string;
  title_normalized: string;
  poet: string | null;
  category: string;
  duration_sec: number;
  file_size_bytes: number;
  mime_type: string;
  storage_provider: 'telegram' | 'r2';
  telegram_file_id: string | null;
  r2_object_key: string | null;
  cover_url: string | null;
  published_at: string;
  updated_at: string;
  play_count: number;
  is_deleted: number;
  lyrics_raw?: string | null;
  lyrics_normalized?: string | null;
}

