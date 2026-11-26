import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Track } from '@shared/types/track';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { formatDuration } from '../utils/format';
import { TrackCover } from './TrackCover';
import { Icon } from './Icon';

interface TrackRowProps {
  track: Track;
  theme: ThemePalette;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  isDownloaded: boolean;
  downloadProgress?: number;
  snippet?: string | null;
  onPress: () => void;
  onLyricsPress: () => void;
  onToggleFavorite: () => void;
  onDownloadPress: () => void;
  onPlaylistPress: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = React.memo(({
  track,
  theme,
  isCurrent,
  isPlaying,
  isFavorite,
  isDownloaded,
  downloadProgress,
  snippet,
  onPress,
  onLyricsPress,
  onToggleFavorite,
  onDownloadPress,
  onPlaylistPress,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isCurrent
            ? theme.accentSoft
            : pressed
              ? theme.surfaceAlt
              : theme.surface,
          borderColor: isCurrent ? theme.accent : theme.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`تشغيل ${track.title}`}
    >
      <TrackCover
        palette={track.palette}
        coverUrl={track.coverUrl}
        size={54}
        borderRadius={14}
        isCurrent={isCurrent}
        isPlaying={isCurrent && isPlaying}
      />

      <View style={styles.meta}>
        <View style={styles.titleLine}>
          <Text
            style={[
              styles.title,
              { color: isCurrent ? theme.accent : theme.textPrimary },
            ]}
            numberOfLines={1}
          >
            {track.title}
          </Text>
          {track.hasLyrics && (
            <Pressable
              onPress={(e: unknown) => {
                (e as { stopPropagation?: () => void })?.stopPropagation?.();
                onLyricsPress();
              }}
              style={[styles.lyricsBadge, { backgroundColor: theme.surfaceAlt }]}
              hitSlop={6}
            >
              <Text style={[styles.lyricsBadgeText, { color: theme.textSecondary }]}>كلمات</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.subLine}>
          <Text style={[styles.subText, { color: theme.textSecondary }]} numberOfLines={1}>
            {track.category}
            {track.poet ? ` • ${track.poet}` : ''}
          </Text>
          <Text style={[styles.duration, { color: theme.textMuted }]}>
            {formatDuration(track.durationSec)}
          </Text>
        </View>

        {snippet ? (
          <Text
            style={[styles.snippet, { color: theme.accent }]}
            numberOfLines={1}
          >
            «{snippet}»
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={(e: unknown) => {
            (e as { stopPropagation?: () => void })?.stopPropagation?.();
            onToggleFavorite();
          }}
          style={styles.iconBtn}
          hitSlop={6}
          accessibilityLabel="إضافة للمفضلة"
        >
          <Icon
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={19}
            color={isFavorite ? theme.danger : theme.textMuted}
          />
        </Pressable>

        <Pressable
          onPress={(e: unknown) => {
            (e as { stopPropagation?: () => void })?.stopPropagation?.();
            onDownloadPress();
          }}
          style={styles.iconBtn}
          hitSlop={6}
          accessibilityLabel={isDownloaded ? 'محفوظ أوفلاين' : 'تحميل أوفلاين'}
        >
          {downloadProgress !== undefined ? (
            <Text style={[styles.dlPct, { color: theme.accent }]}>{downloadProgress}%</Text>
          ) : (
            <Icon
              name={isDownloaded ? 'check-circle' : 'download'}
              size={18}
              color={isDownloaded ? theme.emerald : theme.textMuted}
            />
          )}
        </Pressable>

        <Pressable
          onPress={(e: unknown) => {
            (e as { stopPropagation?: () => void })?.stopPropagation?.();
            onPlaylistPress();
          }}
          style={styles.iconBtn}
          hitSlop={6}
          accessibilityLabel="إضافة إلى قائمة تشغيل"
        >
          <Icon name="playlist" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 11,
    marginBottom: 9,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: FONTS.ui,
    fontSize: 14.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  lyricsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  lyricsBadgeText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '600',
  },
  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    flexShrink: 1,
  },
  duration: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
    fontWeight: '500',
  },
  snippet: {
    fontFamily: FONTS.lyrics,
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    width: 32,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  dlPct: {
    fontSize: 10,
    fontWeight: '700',
  },
});

