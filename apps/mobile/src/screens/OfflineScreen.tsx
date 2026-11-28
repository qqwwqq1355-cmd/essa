import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { formatFileSize } from '../utils/format';
import { TrackRow } from '../components/TrackRow';
import { Icon } from '../components/Icon';
import { InlineAdSlot } from '../components/InlineAdSlot';

interface OfflineScreenProps {
  theme: ThemePalette;
}

type SortMode = 'newest' | 'popular' | 'alpha';

export const OfflineScreen: React.FC<OfflineScreenProps> = ({ theme }) => {
  const {
    tracks,
    currentTrackId,
    isPlaying,
    favorites,
    downloadedIds,
    downloadingIds,
    cacheLimitMb,
    playTrack,
    toggleFavorite,
    downloadTrack,
    removeDownload,
    clearAllDownloads,
    openPlaylistPicker,
    importLocalAudioFile,
  } = useAppStore();

  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const offlineTracks = useMemo(() => {
    const base = tracks.filter(
      (t) => downloadedIds.includes(t.id) || t.storageProvider === 'local'
    );
    const sorted = [...base];
    if (sortMode === 'popular') {
      sorted.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    } else if (sortMode === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    } else {
      sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }
    return sorted;
  }, [tracks, downloadedIds, sortMode]);

  const offlineBytes = useMemo(
    () => offlineTracks.reduce((acc, t) => acc + (t.fileSizeBytes || 0), 0),
    [offlineTracks]
  );

  const offlineUsedPct = Math.min(
    100,
    Math.round((offlineBytes / (cacheLimitMb * 1024 * 1024)) * 100)
  );

  const cycleSort = () => {
    const order: SortMode[] = ['newest', 'popular', 'alpha'];
    setSortMode(order[(order.indexOf(sortMode) + 1) % order.length]);
  };

  const sortLabel: Record<SortMode, string> = {
    newest: 'الأحدث',
    popular: 'الأكثر استماعاً',
    alpha: 'أبجدياً',
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importLocalAudioFile(file);
    e.target.value = '';
  };

  const offlineIds = useMemo(() => offlineTracks.map((t) => t.id), [offlineTracks]);

  return (
    <View style={styles.root}>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.textPrimary }]}>
          المحمّلة ({offlineTracks.length})
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => fileInputRef.current?.click()}
            style={[styles.pillBtn, { backgroundColor: theme.accentSoft }]}
          >
            <Icon name="upload" size={14} color={theme.accent} />
            <Text style={[styles.pillBtnText, { color: theme.accent }]}>استيراد MP3</Text>
          </Pressable>

          <Pressable
            onPress={cycleSort}
            style={[
              styles.pillBtn,
              { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.pillBtnText, { color: theme.textSecondary }]}>
              فرز: {sortLabel[sortMode]}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        <InlineAdSlot theme={theme} label="إعلان مموّل • Unity Ads" />

        {/* بطاقة مساحة التخزين الأوفلاين */}
        <View style={[styles.storageCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.storageTop}>
            <View style={styles.rowGap}>
              <Icon name="wifi-off" size={17} color={theme.emerald} />
              <Text style={[styles.storageTitle, { color: theme.textPrimary }]}>
                الاستماع بدون إنترنت
              </Text>
            </View>
            {downloadedIds.length > 0 && (
              <Pressable onPress={clearAllDownloads}>
                <Text style={[styles.clearText, { color: theme.danger }]}>تفريغ الكل</Text>
              </Pressable>
            )}
          </View>

          <Text style={[styles.storageSub, { color: theme.textSecondary }]}>
            {formatFileSize(offlineBytes)} مستخدمة من أصل {cacheLimitMb} MB ({offlineTracks.length} ملف متاح أوفلاين)
          </Text>

          <View style={[styles.barBg, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max(4, offlineUsedPct)}%`, backgroundColor: theme.emerald },
              ]}
            />
          </View>

          {offlineTracks.length > 0 && (
            <Pressable
              onPress={() => void playTrack(offlineTracks[0].id, offlineIds)}
              style={[styles.playAllBtn, { backgroundColor: theme.accent }]}
            >
              <Icon name="play" size={15} color={theme.accentText} />
              <Text style={[styles.playAllText, { color: theme.accentText }]}>
                تشغيل جميع الزوامل المحمّلة
              </Text>
            </Pressable>
          )}
        </View>

        {offlineTracks.length > 0 ? (
          offlineTracks.map((track) => (
            <View key={track.id} style={styles.offlineItemWrap}>
              <View style={styles.offlineRowFlex}>
                <TrackRow
                  track={track}
                  theme={theme}
                  isCurrent={currentTrackId === track.id}
                  isPlaying={currentTrackId === track.id && isPlaying}
                  isFavorite={favorites.includes(track.id)}
                  isDownloaded={downloadedIds.includes(track.id)}
                  downloadProgress={downloadingIds[track.id]}
                  onPress={() => void playTrack(track.id, offlineIds)}
                  onLyricsPress={() => void playTrack(track.id, offlineIds, 'lyrics')}
                  onToggleFavorite={() => toggleFavorite(track.id)}
                  onDownloadPress={() =>
                    downloadedIds.includes(track.id)
                      ? removeDownload(track.id)
                      : downloadTrack(track.id)
                  }
                  onPlaylistPress={() => openPlaylistPicker(track.id)}
                />
              </View>
              <Pressable
                onPress={() => removeDownload(track.id)}
                style={[
                  styles.deleteItemBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                accessibilityLabel="حذف الزامل من المحمّلة"
              >
                <Icon name="trash" size={16} color={theme.danger} />
              </Pressable>
            </View>
          ))
        ) : (
          <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Icon name="download" size={34} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              لا توجد زوامل محمّلة بعد
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              اضغط أيقونة التحميل بجانب أي زامل لحفظه والاستماع إليه لاحقاً بدون إنترنت، أو استورد ملف MP3 من جهازك.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  heading: {
    fontFamily: FONTS.ui,
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 7,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  pillBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollBody: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    gap: 10,
  },
  storageCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 14,
    gap: 9,
  },
  storageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storageTitle: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    fontWeight: '700',
  },
  clearText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  storageSub: {
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  barBg: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    marginTop: 2,
  },
  playAllText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 26,
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  emptyTitle: {
    fontFamily: FONTS.ui,
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  offlineItemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlineRowFlex: {
    flex: 1,
    minWidth: 0,
  },
  deleteItemBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

