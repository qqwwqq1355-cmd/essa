import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ArtworkPalette } from '@shared/types/track';

interface TrackCoverProps {
  palette: ArtworkPalette;
  coverUrl?: string | null;
  size?: number;
  borderRadius?: number;
  isPlaying?: boolean;
  isCurrent?: boolean;
  titleInitial?: string;
}

export const TrackCover: React.FC<TrackCoverProps> = ({
  palette,
  coverUrl,
  size = 54,
  borderRadius = 14,
  isPlaying = false,
  isCurrent = false,
  titleInitial,
}) => {
  const gradId = `g_${palette.primary.replace('#', '')}_${palette.accent.replace('#', '')}_${size}`;
  const glowId = `r_${palette.accent.replace('#', '')}_${size}`;

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
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
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

          {/* شعار وسطي بارز وواضح */}
          {!isPlaying && (
            <g>
              <circle cx="60" cy="60" r={size >= 140 ? 34 : 26} fill="rgba(10,12,16,0.52)" stroke={palette.accent} strokeWidth="1.4" strokeOpacity="0.65" />
              {size >= 140 && titleInitial ? (
                <text
                  x="60"
                  y="71"
                  textAnchor="middle"
                  fontSize="38"
                  fontWeight="700"
                  fill={palette.accent}
                  fontFamily="Amiri, serif"
                >
                  {titleInitial}
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

      {isPlaying && (
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
};

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
