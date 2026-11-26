const UPSTREAM_ORIGIN = 'https://essa-alleth-edge-api.qqwwqq1355.workers.dev';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, X-App-Client, Authorization',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // إذا فتح المستخدم الرابط الرئيسي في المتصفح نعرض صفحة الحالة
    if (url.pathname === '/' || url.pathname === '/index.html') {
      if (env && env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return new Response(JSON.stringify({ ok: true, service: 'essa-alleth-pages-proxy' }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM_ORIGIN);

    const headers = new Headers(request.headers);
    headers.delete('host');

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(key, value);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

