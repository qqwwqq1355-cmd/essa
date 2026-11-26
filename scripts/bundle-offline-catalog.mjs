import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const API_BASE = (process.env.VITE_API_BASE_URL || 'https://essa-pages-proxy.vercel.app').replace(/\/+$/, '');
const OUT_DIR = path.resolve('apps/mobile/public/offline');
const COVERS_DIR = path.join(OUT_DIR, 'covers');

fs.mkdirSync(COVERS_DIR, { recursive: true });

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function fetchAllTracks() {
  const all = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`${API_BASE}/v1/sync?limit=250&offset=${offset}`);
    if (!res.ok) throw new Error(`Sync HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data.tracks) ? data.tracks : [];
    for (const t of list) {
      if (t.isDeleted) continue;
      if (t.streamUrl && /^https?:\/\/[^/]+\.(workers|pages)\.dev\//i.test(t.streamUrl)) {
        t.streamUrl = t.streamUrl.replace(/^https?:\/\/[^/]+\.(workers|pages)\.dev/i, API_BASE);
      }
      if (t.coverUrl && /^https?:\/\/[^/]+\.(workers|pages)\.dev\//i.test(t.coverUrl)) {
        t.coverUrl = t.coverUrl.replace(/^https?:\/\/[^/]+\.(workers|pages)\.dev/i, API_BASE);
      }
      all.push(t);
    }
    if (!data.hasMore || list.length === 0) break;
    offset += 250;
  }
  return all;
}

async function downloadAndCompressCover(track, useFfmpeg) {
  if (!track.coverUrl) return null;
  const fileName = `${track.id}.jpg`;
  const outPath = path.join(COVERS_DIR, fileName);
  const tmpPath = path.join(COVERS_DIR, `${track.id}.tmp.jpg`);

  try {
    const res = await fetch(track.coverUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return null;

    if (useFfmpeg) {
      fs.writeFileSync(tmpPath, buf);
      try {
        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-i',
            tmpPath,
            '-vf',
            'scale=160:160:force_original_aspect_ratio=increase,crop=160:160',
            '-q:v',
            '8',
            outPath,
          ],
          { stdio: 'ignore' }
        );
        fs.rmSync(tmpPath, { force: true });
      } catch {
        fs.renameSync(tmpPath, outPath);
      }
    } else {
      fs.writeFileSync(outPath, buf);
    }

    return `/offline/covers/${fileName}`;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`[bundle-offline] Fetching catalog from ${API_BASE}...`);
  const tracks = await fetchAllTracks();
  const useFfmpeg = hasFfmpeg();
  console.log(`[bundle-offline] Fetched ${tracks.length} tracks (ffmpeg=${useFfmpeg}). Downloading covers...`);

  let bundledCovers = 0;
  const CONCURRENCY = 12;
  let idx = 0;

  async function worker() {
    while (idx < tracks.length) {
      const i = idx++;
      const t = tracks[i];
      if (!t.coverUrl) continue;
      const localUrl = await downloadAndCompressCover(t, useFfmpeg);
      if (localUrl) {
        t.coverUrl = localUrl;
        bundledCovers++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const catalogPath = path.join(OUT_DIR, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify({ tracks }), 'utf8');
  const jsonKb = Math.round(fs.statSync(catalogPath).size / 1024);
  console.log(`[bundle-offline] ✓ Saved ${tracks.length} tracks (${jsonKb} KB) + ${bundledCovers} compressed covers!`);
}

main().catch((err) => {
  console.warn('[bundle-offline] Non-fatal warning:', err?.message || err);
});

