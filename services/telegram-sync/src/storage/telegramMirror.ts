import type { TelegramClient } from 'telegram';
import type { Api } from 'telegram';
import type { EntityLike } from 'telegram/define';
import type { SyncConfig } from '../config';

export interface ArchivedAudioResult {
  archiveMessageId: number;
  botFileId: string | null;
}

const BOT_API_MAX_BYTES = 20 * 1024 * 1024; // حد Bot API الرسمي 20MB

/**
 * يوجّه المقطع الصوتي بسرعة فائقة عبر MTProto من القناة العامة (@IssaAllaith) إلى قناتك الخاصة
 * بدون استدعاء Bot API من جهازك (حتى لا يتأثر بـ 429 من IP الـ VPN)؛
 * ويقوم Cloudflare Worker تلقائياً باستخراج وحفظ file_id من خوادمه النظيفة عند أول تشغيل!
 */
export async function mirrorAudioToPrivateChannel(
  client: TelegramClient,
  archivePeer: EntityLike,
  sourcePeer: EntityLike,
  _config: SyncConfig,
  sourceMessage: Api.Message,
  fileSizeBytes: number
): Promise<ArchivedAudioResult> {
  const forwarded = await client.forwardMessages(archivePeer, {
    messages: [sourceMessage.id],
    fromPeer: sourcePeer,
  });

  const flat = Array.isArray(forwarded) ? forwarded.flat() : [forwarded];
  const archiveMsg = flat[0];
  const archiveMessageId = archiveMsg?.id ?? 0;

  if (!archiveMessageId) {
    throw new Error(`Failed to forward source message #${sourceMessage.id} to archive channel.`);
  }

  if (fileSizeBytes > BOT_API_MAX_BYTES) {
    console.warn(
      `[mirror] Message #${sourceMessage.id} exceeds 20MB Bot API limit (${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB).`
    );
  }

  return { archiveMessageId, botFileId: null };
}
