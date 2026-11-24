/**
 * مولّد صوت معاينة هادئ وموسيقي (WAV Blob) لوضع التجربة قبل ربط قناة تليجرام الحقيقية.
 * يتيح تشغيل المشغّل الصوتي الفعلي (<audio>) والتقديم والترجيع وسرعة التشغيل والتحميل الأوفلاين في Chrome فوراً.
 */

const cachedPreviewUrls = new Map<string, string>();

// سلم حجاز شرقي دافئ (ترددات بالهرتز)
const HIJAZ_SCALES: number[][] = [
  [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 277.18, 293.66],
  [164.81, 174.61, 207.65, 220.0, 246.94, 261.63, 311.13, 329.63],
  [130.81, 138.59, 164.81, 174.61, 196.0, 207.65, 246.94, 261.63],
];

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function getOrCreatePreviewAudioUrl(trackId: string, durationSec: number, seed: number): string {
  const existing = cachedPreviewUrls.get(trackId);
  if (existing) return existing;

  const sampleRate = 22050;
  const clampedDuration = Math.min(48, Math.max(24, durationSec || 36));
  const numSamples = Math.floor(sampleRate * clampedDuration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV Header (PCM 16-bit Mono)
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const scale = HIJAZ_SCALES[Math.abs(seed) % HIJAZ_SCALES.length];
  const rootFreq = scale[0];
  const fifthFreq = scale[4];
  const noteStepSec = 0.68;

  // نغمة ناعمة دافئة شبيهة بالعود الهادئ + خلفية هارمونية لطيفة
  const melodyPattern = [0, 2, 3, 4, 3, 2, 1, 0, 4, 5, 4, 3, 2, 3, 1, 0];
  const patternOffset = Math.abs(seed) % melodyPattern.length;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Fade in / Fade out ناعم
    const fadeIn = Math.min(1, t / 1.2);
    const fadeOut = Math.min(1, (clampedDuration - t) / 1.8);
    const masterEnv = fadeIn * fadeOut;

    // خلفية دافئة (Drone Pad)
    const drone =
      Math.sin(2 * Math.PI * rootFreq * t) * 0.14 +
      Math.sin(2 * Math.PI * (fifthFreq * 0.5) * t) * 0.08;

    // نغمة العود المتقطعة اللطيفة
    const noteIndex = Math.floor(t / noteStepSec);
    const localT = t - noteIndex * noteStepSec;
    const scaleIdx = melodyPattern[(noteIndex + patternOffset) % melodyPattern.length];
    const freq = scale[scaleIdx] * 2;

    const pluckEnv = Math.exp(-localT * 4.2) * Math.min(1, localT / 0.012);
    const pluck =
      (Math.sin(2 * Math.PI * freq * t) * 0.65 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.22 +
        Math.sin(2 * Math.PI * freq * 3 * t) * 0.08) *
      pluckEnv *
      0.24;

    // إيقاع دف خفيف جداً في الخلفية
    const beatT = t % (noteStepSec * 2);
    const pulseEnv = Math.exp(-beatT * 18);
    const softPerc = Math.sin(2 * Math.PI * (78 - beatT * 40) * beatT) * pulseEnv * 0.1;

    const sample = Math.max(-0.92, Math.min(0.92, (drone + pluck + softPerc) * masterEnv));
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  cachedPreviewUrls.set(trackId, url);
  return url;
}

