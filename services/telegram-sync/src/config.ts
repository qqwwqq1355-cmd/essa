import 'dotenv/config';

export interface SyncConfig {
  sourceChannelUsername: string;
  telegramApiId: number;
  telegramApiHash: string;
  telegramStringSession: string;
  telegramBotToken: string;
  telegramArchiveChannelId: string;
  storageMode: 'github' | 'telegram' | 'r2';
  githubToken: string;
  githubRepository: string;
  githubReleaseTag: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  cloudflareD1DatabaseId: string;
  syncMode: 'incremental' | 'backfill';
  batchLimit: number;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[telegram-sync] Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): SyncConfig {
  const isBackfillFlag = process.argv.includes('--backfill');
  const rawMode = isBackfillFlag ? 'backfill' : (process.env.SYNC_MODE || 'incremental');
  const rawStorage = (process.env.STORAGE_MODE || 'github').trim().toLowerCase();
  const storageMode: 'github' | 'telegram' | 'r2' =
    rawStorage === 'r2' ? 'r2' : rawStorage === 'telegram' ? 'telegram' : 'github';

  return {
    sourceChannelUsername: (process.env.SOURCE_CHANNEL_USERNAME || 'IssaAllaith').replace(/^@/, ''),
    telegramApiId: Number(requiredEnv('TELEGRAM_API_ID')),
    telegramApiHash: requiredEnv('TELEGRAM_API_HASH'),
    telegramStringSession: requiredEnv('TELEGRAM_STRING_SESSION'),
    telegramBotToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    telegramArchiveChannelId: (process.env.TELEGRAM_ARCHIVE_CHANNEL_ID || '').trim(),
    storageMode,
    githubToken: storageMode === 'github' ? requiredEnv('GITHUB_TOKEN') : (process.env.GITHUB_TOKEN || '').trim(),
    githubRepository: (process.env.GITHUB_REPOSITORY || 'qqwwqq1355-cmd/essa').trim(),
    githubReleaseTag: (process.env.GITHUB_RELEASE_TAG || 'audio-v1').trim(),
    cloudflareAccountId: requiredEnv('CLOUDFLARE_ACCOUNT_ID'),
    cloudflareApiToken: requiredEnv('CLOUDFLARE_API_TOKEN'),
    cloudflareD1DatabaseId: requiredEnv('CLOUDFLARE_D1_DATABASE_ID'),
    syncMode: rawMode === 'backfill' ? 'backfill' : 'incremental',
    batchLimit: Math.min(200, Math.max(10, Number(process.env.SYNC_BATCH_LIMIT || 50))),
  };
}
