import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Track } from '@shared/types/track';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { TrackCover } from './TrackCover';
import { Icon } from './Icon';

interface MiniPlayerProps {
  track: Track;
  theme: ThemePalette;
  isPlaying: boolean;
  isBuffering?: boolean;
  positionSec: number;
  durationSec: number;
  isFavorite: boolean;
  onOpenFull: () => void;
  onOpenLyrics: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onToggleFavorite: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  track,
  theme,
  isPlaying,
  isBuffering = false,
  positionSec,
  durationSec,
  isFavorite,
  onOpenFull,
  onOpenLyrics,
  onTogglePlay,
  onNext,
  onToggleFavorite,
}) => {
  const pct = durationSec > 0 ? Math.min(100, Math.max(0, (positionSec / durationSec) * 100)) : 0;

  return (
    <View style={styles.outer}>
      <Pressable
        onPress={onOpenFull}
        style={[
          styles.container,
          {
            backgroundColor: theme.miniPlayerBg,
            borderColor: theme.borderStrong,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`فتح المشغل الكامل لـ ${track.title}`}
      >
        {/* شريط التقدم الرفيع */}
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%`, backgroundColor: theme.accent },
            ]}
          />
        </View>

        <View style={styles.content}>
          <TrackCover
            palette={track.palette}
            size={44}
            borderRadius={11}
            isCurrent
            isPlaying={isPlaying}
          />

          <View style={styles.info}>
            <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              عيسى الليث • {track.category}
            </Text>
          </View>

          <View style={styles.controls}>
            <Pressable
              onPress={(e: unknown) => {
                (e as { stopPropagation?: () => void })?.stopPropagation?.();
                onOpenLyrics();
              }}
              style={styles.ctrlBtn}
              hitSlop={6}
              accessibilityLabel="عرض الكلمات"
            >
              <Icon name="lyrics" size={19} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              onPress={(e: unknown) => {
                (e as { stopPropagation?: () => void })?.stopPropagation?.();
                onToggleFavorite();
              }}
              style={styles.ctrlBtn}
              hitSlop={6}
              accessibilityLabel="مفضلة"
            >
              <Icon
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={19}
                color={isFavorite ? theme.danger : theme.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={(e: unknown) => {
                (e as { stopPropagation?: () => void })?.stopPropagation?.();
                onTogglePlay();
              }}
              style={[styles.playBtn, { backgroundColor: theme.accent }]}
              hitSlop={6}
              accessibilityLabel={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isBuffering ? (
                <ActivityIndicator size="small" color={theme.accentText} />
              ) : (
                <Icon name={isPlaying ? 'pause' : 'play'} size={19} color={theme.accentText} />
              )}
            </Pressable>

            <Pressable
              onPress={(e: unknown) => {
                (e as { stopPropagation?: () => void })?.stopPropagation?.();
                onNext();
              }}
              style={styles.ctrlBtn}
              hitSlop={6}
              accessibilityLabel="المقطع التالي"
            >
              <Icon name="next" size={18} color={theme.textPrimary} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    backdropFilter: 'blur(16px)',
  },
  progressTrack: {
    height: 2.5,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ctrlBtn: {
    width: 34,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

