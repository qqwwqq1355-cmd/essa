import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ArtworkPalette } from '@shared/types/track';

interface TrackCoverProps {
  palette: ArtworkPalette;
  size?: number;
  borderRadius?: number;
  isPlaying?: boolean;
  isCurrent?: boolean;
  titleInitial?: string;
}

export const TrackCover: React.FC<TrackCoverProps> = ({
  palette,
  size = 54,
  borderRadius = 14,
  isPlaying = false,
  isCurrent = false,
  titleInitial,
}) => {
  const gradId = `g_${palette.primary.replace('#', '')}_${palette.accent.replace('#', '')}_${size}`;

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius,
          borderColor: isCurrent ? palette.accent : 'rgba(255,255,255,0.1)',
          borderWidth: isCurrent ? 1.5 : 1,
        },
      ]}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        style={{ display: 'block', borderRadius }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.primary} />
            <stop offset="100%" stopColor={palette.secondary} />
          </linearGradient>
        </defs>
        <rect width="120" height="120" fill={`url(#${gradId})`} />

        {/* زخرفة هندسية عربية تراثية عصرية خفيفة */}
        {palette.pattern === 'geometric' && (
          <g opacity="0.22" stroke={palette.accent} strokeWidth="1.2" fill="none">
            <polygon points="60,14 106,60 60,106 14,60" />
            <rect x="28" y="28" width="64" height="64" />
            <circle cx="60" cy="60" r="22" />
          </g>
        )}
        {palette.pattern === 'arch' && (
          <g opacity="0.24" stroke={palette.accent} strokeWidth="1.3" fill="none">
            <path d="M24 106V54C24 30 60 16 60 16C60 16 96 30 96 54V106" />
            <path d="M36 106V60C36 42 60 32 60 32C60 32 84 42 84 60V106" />
            <circle cx="60" cy="62" r="10" />
          </g>
        )}
        {palette.pattern === 'stars' && (
          <g opacity="0.24" stroke={palette.accent} strokeWidth="1.2" fill="none">
            <circle cx="60" cy="60" r="38" strokeDasharray="4 4" />
            <polygon points="60,18 71,49 102,60 71,71 60,102 49,71 18,60 49,49" />
          </g>
        )}
        {palette.pattern === 'waves' && (
          <g opacity="0.26" stroke={palette.accent} strokeWidth="1.4" fill="none">
            <path d="M0 44 Q30 28 60 44 T120 44" />
            <path d="M0 64 Q30 48 60 64 T120 64" />
            <path d="M0 84 Q30 68 60 84 T120 84" />
          </g>
        )}

        {/* توهّج ناعم */}
        <circle cx="96" cy="24" r="28" fill={palette.accent} opacity="0.14" />

        {/* موجة صوتية صغيرة في الوسط أو حرف أول أنيق */}
        {!isPlaying && (
          <g fill={palette.accent} opacity="0.92">
            {size >= 140 && titleInitial ? (
              <text
                x="60"
                y="68"
                textAnchor="middle"
                fontSize="36"
                fontWeight="700"
                fontFamily="Amiri, serif"
              >
                {titleInitial}
              </text>
            ) : (
              <>
                <rect x="44" y="54" width="4" height="16" rx="2" />
                <rect x="52" y="42" width="4" height="36" rx="2" />
                <rect x="60" y="34" width="4" height="52" rx="2" />
                <rect x="68" y="46" width="4" height="28" rx="2" />
                <rect x="76" y="56" width="4" height="12" rx="2" />
              </>
            )}
          </g>
        )}
      </svg>

      {isPlaying && (
        <View style={styles.eqOverlay}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: size >= 120 ? 6 : 3,
              height: size >= 120 ? 36 : 18,
            }}
          >
            {[0, 0.16, 0.32, 0.12].map((delay, i) => (
              <span
                key={i}
                style={{
                  width: size >= 120 ? 6 : 3,
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
    backgroundColor: 'rgba(8, 10, 15, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

