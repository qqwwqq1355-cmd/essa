import crypto from 'node:crypto';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function parseServiceAccount(raw?: string): ServiceAccount | null {
  if (!raw || !raw.trim()) return null;
  try {
    const trimmed = raw.trim();
    const jsonStr = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return null;
    }
    return parsed as ServiceAccount;
  } catch {
    return null;
  }
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64UrlEncode(signer.sign(sa.private_key));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`OAuth token error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Missing access_token in Google OAuth response');
  }
  return data.access_token;
}

export async function sendNewTrackNotification(params: {
  trackId: string;
  title: string;
  poet?: string | null;
  coverUrl?: string | null;
  edgeApiUrl?: string;
}): Promise<void> {
  const sa = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!sa) return;

  try {
    const accessToken = await getGoogleAccessToken(sa);
    const fullImageUrl =
      params.coverUrl && params.coverUrl.startsWith('http')
        ? params.coverUrl
        : params.edgeApiUrl
          ? `${params.edgeApiUrl.replace(/\/+$/, '')}/v1/covers/${encodeURIComponent(params.trackId)}.jpg`
          : undefined;

    const bodyLine = params.poet
      ? `🎵 ${params.title} — كلمات: ${params.poet}`
      : `🎵 ${params.title} — استمع الآن مع الكلمات كاملة`;

    const fcmPayload = {
      message: {
        topic: 'new_tracks',
        notification: {
          title: '🔥 زامل جديد — عيسى الليث',
          body: bodyLine,
          ...(fullImageUrl ? { image: fullImageUrl } : {}),
        },
        data: {
          trackId: params.trackId,
          title: params.title,
          action: 'open_track',
        },
        android: {
          priority: 'high',
          notification: {
            channel_id: 'new_tracks',
            sound: 'default',
            ...(fullImageUrl ? { image: fullImageUrl } : {}),
          },
        },
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      }
    );

    if (!res.ok) {
      console.warn(`[fcm-notifier] Failed (${res.status}):`, await res.text());
    } else {
      console.log(`[fcm-notifier] ✓ Push notification sent for "${params.title}" (${params.trackId})`);
    }
  } catch (err) {
    console.warn('[fcm-notifier] Error sending push:', err instanceof Error ? err.message : err);
  }
}

