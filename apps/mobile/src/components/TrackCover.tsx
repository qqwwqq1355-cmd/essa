import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ArtworkPalette } from '@shared/types/track';
import { getLoadedCoverSrc, isCoverLoaded, loadCover } from '../services/images/imageLoader';

interface TrackCoverProps {
  palette: ArtworkPalette;
  coverUrl?: string | null;
  size?: number;
  borderRadius?: number;
  isPlaying?: boolean;
  isCurrent?: boolean;
  titleInitial?: string;
  title?: string;
  isLoading?: boolean;
  autoLoadCover?: boolean;
}

function getInitial(title?: string): string {
  if (!title) return '';
  const m = title.match(/[\u0621-\u064A0-9A-Za-z]/);
  return m ? m[0] : title.trim().charAt(0);
}

function normalizeCoverUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/offline/') ? `.${url}` : url;
}

function isLocalCoverUrl(url?: string | null): boolean {
  if (!url) return false;
  return (
    url.startsWith('./') ||
    url.startsWith('offline/') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  );
}

export const TrackCover: React.FC<TrackCoverProps> = React.memo(({
  palette,
  coverUrl,
  size = 54,
  borderRadius = 14,
  isPlaying = false,
  isCurrent = false,
  titleInitial,
  title,
  isLoading = false,
  autoLoadCover = true,
}) => {
  const initial = titleInitial || getInitial(title);
  const showEq = isPlaying && !isLoading;
  const gradId = `g_${palette.primary.replace('#', '')}_${palette.accent.replace('#', '')}_${size}`;
  const glowId = `r_${palette.accent.replace('#', '')}_${size}`;
  const resolvedUrl = normalizeCoverUrl(coverUrl);
  const isLocal = isLocalCoverUrl(resolvedUrl);
  const [inView, setInView] = useState(size >= 100 || isCurrent);
  const [ready, setReady] = useState(() => Boolean(resolvedUrl && (isLocal || isCoverLoaded(resolvedUrl))));
  const [localError, setLocalError] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalError(false);
  }, [resolvedUrl]);

  useEffect(() => {
    if (isLocal || inView || !resolvedUrl) return;
    const el = anchorRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isLocal, inView, resolvedUrl]);

  // للصور المحلية المدمجة: عرض فوري في 0ms بدون طابور شبكة؛ وللصور البعيدة: عبر الطابور المحدود
  useEffect(() => {
    if (!resolvedUrl) {
      setReady(false);
      return;
    }
    if (isLocal) {
      setReady(true);
      return;
    }
    if (isCoverLoaded(resolvedUrl)) {
      setReady(true);
      return;
    }
    setReady(false);
    // للزوامل بعد "عرض المزيد": ننتظر حتى يبدأ الصوت فعلياً (!isLoading) ثم نجلب صورته حتى لا تسبق الصوت أبداً
    if (!autoLoadCover && (!isCurrent || isLoading)) return;
    if (!inView && !isCurrent) return;
    return loadCover(
      resolvedUrl,
      (ok) => {
        if (ok) setReady(true);
      },
      size >= 100 || isCurrent
    );
  }, [resolvedUrl, isLocal, inView, size, isCurrent, isLoading, autoLoadCover]);

  // الصورة تُعرض فقط بعد اكتمال تحميلها فعلياً (أو فوراً إذا كانت مدمجة داخل التطبيق)
  const shouldRenderImg = Boolean(resolvedUrl && (isLocal ? !localError : ready));

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius,
          borderColor: isCurrent ? palette.accent : 'rgba(255,255,255,0.16)',
          borderWidth: isCurrent ? 1.8 : 1,
        },
      ]}
    >
      <div ref={anchorRef} style={{ width: size, height: size, position: 'relative' }}>
      {shouldRenderImg ? (
        <img
          src={isLocal ? resolvedUrl! : getLoadedCoverSrc(resolvedUrl!)}
          alt=""
          decoding="async"
          onError={() => {
            if (isLocal) setLocalError(true);
            else setReady(false);
          }}
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            display: 'block',
            borderRadius,
          }}
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          style={{ display: 'block', borderRadius }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.primary} />
              <stop offset="60%" stopColor={palette.secondary} />
              <stop offset="100%" stopColor="#090C12" />
            </linearGradient>
            <radialGradient id={glowId} cx="78%" cy="22%" r="65%">
              <stop offset="0%" stopColor={palette.accent} stopOpacity="0.42" />
              <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="120" height="120" fill={`url(#${gradId})`} />
          <rect width="120" height="120" fill={`url(#${glowId})`} />

          {/* زخرفة هندسية واضحة وفخمة */}
          {palette.pattern === 'geometric' && (
            <g opacity="0.4" stroke={palette.accent} strokeWidth="1.5" fill="none">
              <polygon points="60,12 108,60 60,108 12,60" />
              <rect x="26" y="26" width="68" height="68" rx="6" />
              <circle cx="60" cy="60" r="26" />
            </g>
          )}
          {palette.pattern === 'arch' && (
            <g opacity="0.42" stroke={palette.accent} strokeWidth="1.6" fill="none">
              <path d="M22 108V54C22 28 60 14 60 14C60 14 98 28 98 54V108" />
              <path d="M34 108V60C34 40 60 30 60 30C60 30 86 40 86 60V108" />
            </g>
          )}
          {palette.pattern === 'stars' && (
            <g opacity="0.4" stroke={palette.accent} strokeWidth="1.5" fill="none">
              <circle cx="60" cy="60" r="42" strokeDasharray="5 4" />
              <polygon points="60,16 72,48 104,60 72,72 60,104 48,72 16,60 48,48" />
            </g>
          )}
          {palette.pattern === 'waves' && (
            <g opacity="0.42" stroke={palette.accent} strokeWidth="1.7" fill="none">
              <path d="M0 40 Q30 24 60 40 T120 40" />
              <path d="M0 62 Q30 46 60 62 T120 62" />
              <path d="M0 84 Q30 68 60 84 T120 84" />
            </g>
          )}

          {/* حرف الزامل داخل أيقونة أنيقة إلى حين ظهور الصورة */}
          {!showEq && (
            <g>
              <circle cx="60" cy="60" r="36" fill="rgba(10,12,16,0.52)" stroke={palette.accent} strokeWidth="1.6" strokeOpacity="0.7" />
              {initial ? (
                <text
                  x="60"
                  y="60"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="44"
                  fontWeight="700"
                  fill={palette.accent}
                  fontFamily="Amiri, serif"
                >
                  {initial}
                </text>
              ) : (
                <g fill={palette.accent}>
                  <rect x="44" y="54" width="4.5" height="14" rx="2.2" />
                  <rect x="52" y="45" width="4.5" height="30" rx="2.2" />
                  <rect x="60" y="39" width="4.5" height="42" rx="2.2" />
                  <rect x="68" y="48" width="4.5" height="24" rx="2.2" />
                  <rect x="76" y="56" width="4.5" height="10" rx="2.2" />
                </g>
              )}
            </g>
          )}
        </svg>
      )}
      </div>

      {isLoading && (
        <View style={styles.eqOverlay}>
          <div
            style={{
              width: size >= 120 ? 46 : size >= 60 ? 26 : 20,
              height: size >= 120 ? 46 : size >= 60 ? 26 : 20,
              borderRadius: '50%',
              border: `${size >= 120 ? 4 : 2.5}px solid rgba(255,255,255,0.22)`,
              borderTopColor: palette.accent,
              animation: 'spinSlow 0.8s linear infinite',
            }}
          />
        </View>
      )}

      {showEq && (
        <View style={styles.eqOverlay}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: size >= 120 ? 6 : 3,
              height: size >= 120 ? 38 : 18,
            }}
          >
            {[0, 0.16, 0.32, 0.12].map((delay, i) => (
              <span
                key={i}
                style={{
                  width: size >= 120 ? 6 : 3.2,
                  height: '100%',
                  borderRadius: 99,
                  backgroundColor: palette.accent,
                  transformOrigin: 'bottom',
                  animation: `eqBarBounce 0.85s ease-in-out ${delay}s infinite`,
                }}
              />
            ))}
          </div>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  eqOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 15, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
