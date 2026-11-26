import type { HealthResponse, SyncResponse } from '@shared/types/track';

const FALLBACK_PRODUCTION_API = 'https://essa-pages-proxy.vercel.app';
const DEFAULT_API_BASE = (import.meta.env.VITE_API_BASE_URL || FALLBACK_PRODUCTION_API)
  .trim()
  .replace(/\/+$/, '');

export function getDefaultApiBaseUrl(): string {
  return DEFAULT_API_BASE;
}

export async function fetchApiHealth(baseUrl: string): Promise<HealthResponse> {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  const res = await fetch(`${clean}/v1/health`);
  if (!res.ok) {
    throw new Error(`فشل الاتصال بالخادم (HTTP ${res.status})`);
  }
  return (await res.json()) as HealthResponse;
}

export async function fetchDeltaSync(baseUrl: string, sinceIso?: string): Promise<SyncResponse> {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  const allTracks: SyncResponse['tracks'] = [];
  let offset = 0;
  let lastMeta: SyncResponse | null = null;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ limit: '250', offset: String(offset) });
    if (sinceIso) params.set('since', sinceIso);

    const res = await fetch(`${clean}/v1/sync?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`تعذرت المزامنة من الخادم (HTTP ${res.status})`);
    }
    const data = (await res.json()) as SyncResponse;
    lastMeta = data;
    const rewrittenTracks = data.tracks.map((t) => {
      const streamUrl =
        t.streamUrl && /^https?:\/\/[^/]+\.(workers|pages)\.dev\//i.test(t.streamUrl)
          ? t.streamUrl.replace(/^https?:\/\/[^/]+\.(workers|pages)\.dev/i, clean)
          : t.streamUrl;
      const coverUrl =
        t.coverUrl && /^https?:\/\/[^/]+\.(workers|pages)\.dev\//i.test(t.coverUrl)
          ? t.coverUrl.replace(/^https?:\/\/[^/]+\.(workers|pages)\.dev/i, clean)
          : t.coverUrl;
      return { ...t, streamUrl, coverUrl };
    });
    allTracks.push(...rewrittenTracks);

    if (!data.hasMore || data.tracks.length === 0) break;
    offset += 250;
  }

  return {
    serverTime: lastMeta?.serverTime || new Date().toISOString(),
    sourceChannel: lastMeta?.sourceChannel || 'IssaAllaith',
    hasMore: false,
    nextCursor: null,
    totalCount: lastMeta?.totalCount ?? allTracks.length,
    tracks: allTracks,
  };
}
