import type { EdgeEnv } from '../types';

interface TelegramGetFileResponse {
  ok: boolean;
  result?: {
    file_id: string;
    file_size?: number;
    file_path?: string;
  };
}

/**
 * يجلب مسار الملف المؤقت من Telegram Bot API ويبثه للمستمع مع دعم HTTP Range Requests (206)
 * بدون كشف TELEGRAM_BOT_TOKEN لتطبيق الهاتف أبداً
 */
export async function streamFromTelegram(
  env: EdgeEnv,
  telegramFileId: string,
  mimeType: string,
  rangeHeader: string | null
): Promise<Response> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1) استخراج file_path المؤقت من Bot API
  const getFileUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(telegramFileId)}`;
  const metaRes = await fetch(getFileUrl, {
    cf: { cacheTtl: 1800, cacheEverything: true }, // تخزين file_path في الكاش 30 دقيقة
  });

  if (!metaRes.ok) {
    return new Response(JSON.stringify({ error: 'Unable to resolve Telegram audio file.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const meta = (await metaRes.json()) as TelegramGetFileResponse;
  if (!meta.ok || !meta.result?.file_path) {
    return new Response(JSON.stringify({ error: 'Telegram file_path unavailable.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2) بث الملف من خوادم تليجرام وتمرير Range Header لدعم التقديم والترجيع الفوري (Seeking)
  const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${meta.result.file_path}`;
  const upstreamHeaders = new Headers();
  if (rangeHeader) {
    upstreamHeaders.set('Range', rangeHeader);
  }

  const upstream = await fetch(fileUrl, { headers: upstreamHeaders });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(JSON.stringify({ error: 'Telegram audio upstream failed.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', mimeType || 'audio/mpeg');
  responseHeaders.set('Accept-Ranges', 'bytes');
  responseHeaders.set('Cache-Control', 'public, max-age=3600');
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  const contentLength = upstream.headers.get('Content-Length');
  const contentRange = upstream.headers.get('Content-Range');
  if (contentLength) responseHeaders.set('Content-Length', contentLength);
  if (contentRange) responseHeaders.set('Content-Range', contentRange);

  return new Response(upstream.body, {
    status: upstream.status, // 200 أو 206 Partial Content
    headers: responseHeaders,
  });
}

/**
 * بث مباشر عالي السرعة من Cloudflare R2 عند الترقية لوضع التوسع التجاري
 */
export async function streamFromR2(
  bucket: R2Bucket,
  objectKey: string,
  mimeType: string,
  rangeHeader: string | null
): Promise<Response> {
  const object = rangeHeader
    ? await bucket.get(objectKey, { range: new Headers({ Range: rangeHeader }) })
    : await bucket.get(objectKey);

  if (!object) {
    return new Response(JSON.stringify({ error: 'Audio object not found in R2.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', mimeType || 'audio/mpeg');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=86400');
  headers.set('Access-Control-Allow-Origin', '*');

  const isPartial = Boolean(rangeHeader && object.range);
  if (isPartial && object.range && 'offset' in object.range && 'length' in object.range) {
    const start = object.range.offset ?? 0;
    const length = object.range.length ?? object.size;
    headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
  } else {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(object.body, {
    status: isPartial ? 206 : 200,
    headers,
  });
}

