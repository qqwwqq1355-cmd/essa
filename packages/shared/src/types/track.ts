export type StorageProvider = 'github' | 'telegram' | 'r2' | 'preview' | 'local';

export type TrackCategory =
  | 'زوامل'
  | 'أناشيد'
  | 'قصائد'
  | 'تراثية'
  | 'مناسبات'
  | 'أخرى';

export interface ArtworkPalette {
  primary: string;
  secondary: string;
  accent: string;
  pattern: 'geometric' | 'waves' | 'stars' | 'arch';
}

export interface Track {
  id: string;
  sourceChannel: string;
  sourceMessageId: number;
  title: string;
  titleNormalized: string;
  poet: string | null;
  category: TrackCategory;
  durationSec: number;
  fileSizeBytes: number;
  mimeType: string;
  storageProvider: StorageProvider;
  streamUrl?: string;
  coverUrl?: string | null;
  palette: ArtworkPalette;
  publishedAt: string;
  updatedAt: string;
  hasLyrics: boolean;
  lyrics?: string | null;
  lyricsNormalized?: string | null;
  playCount?: number;
  isDeleted?: boolean;
  isDemoPreview?: boolean;
}

export interface SyncResponse {
  serverTime: string;
  sourceChannel: string;
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number;
  tracks: Track[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  sourceChannel: string;
  storageMode: 'telegram' | 'r2';
  lastSyncAt: string | null;
  totalTracks: number;
  timestamp: string;
}

export interface ParsedTelegramPost {
  title: string;
  poet: string | null;
  category: TrackCategory;
  lyricsRaw: string | null;
  hashtags: string[];
}

