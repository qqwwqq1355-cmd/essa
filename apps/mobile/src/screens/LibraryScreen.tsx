import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { formatFileSize } from '../utils/format';
import { TrackRow } from '../components/TrackRow';
import { Icon } from '../components/Icon';
import { InlineAdSlot } from '../components/InlineAdSlot';

interface LibraryScreenProps {
  theme: ThemePalette;
}

type LibrarySegment = 'favorites' | 'playlists' | 'history' | 'all';
type SortMode = 'newest' | 'popular' | 'alpha';

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ theme }) => {
  const {
    tracks,
    currentTrackId,
    isPlaying,
    favorites,
    downloadedIds,
    downloadingIds,
    playlists,
    playHistory,
    playTrack,
    toggleFavorite,
    downloadTrack,
    removeDownload,
    clearPlayHistory,
    createPlaylist,
    deletePlaylist,
    openPlaylistPicker,
    importLocalAudioFile,
  } = useAppStore();

  const [segment, setSegment] = useState<LibrarySegment>('favorites');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const displayedTracks = useMemo(() => {
    if (segment === 'history') {
      return playHistory
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t));
    }

    let base = tracks;
    if (segment === 'favorites') {
      base = tracks.filter((t) => favorites.includes(t.id));
    }

    const sorted = [...base];
    if (sortMode === 'popular') {
      sorted.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    } else if (sortMode === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    } else {
      sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }
    return sorted;
  }, [tracks, segment, favorites, playHistory, sortMode]);

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

  const displayedIds = displayedTracks.map((t) => t.id);

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
        <Text style={[styles.heading, { color: theme.textPrimary }]}>المكتبة</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => fileInputRef.current?.click()}
            style={[styles.pillBtn, { backgroundColor: theme.accentSoft }]}
          >
            <Icon name="upload" size={14} color={theme.accent} />
            <Text style={[styles.pillBtnText, { color: theme.accent }]}>استيراد MP3</Text>
          </Pressable>

          {segment !== 'playlists' && segment !== 'history' && (
            <Pressable
              onPress={cycleSort}
              style={[styles.pillBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
            >
              <Text style={[styles.pillBtnText, { color: theme.textSecondary }]}>
                فرز: {sortLabel[sortMode]}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* شريط الأقسام */}
      <View style={styles.segmentWrap}>
        <View style={[styles.segmentBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(
            [
              { id: 'favorites', label: `المفضلة (${favorites.length})` },
              { id: 'playlists', label: `قوائم (${playlists.length})` },
              { id: 'history', label: `السجل (${playHistory.length})` },
              { id: 'all', label: `الكل (${tracks.length})` },
            ] as const
          ).map((item) => {
            const active = segment === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSegment(item.id)}
                style={[styles.segBtn, active && { backgroundColor: theme.accent }]}
              >
                <Text
                  style={[
                    styles.segLabel,
                    { color: active ? theme.accentText : theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        <InlineAdSlot theme={theme} label="إعلان مموّل • Start.io" />

        {/* بطاقة سجل الاستماع / استكمل الاستماع */}
        {segment === 'history' && (
          <View style={[styles.storageCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.storageTop}>
              <View style={styles.rowGap}>
                <Icon name="clock" size={17} color={theme.accent} />
                <Text style={[styles.storageTitle, { color: theme.textPrimary }]}>
                  سجل الاستماع — استكمل من حيث توقفت
                </Text>
              </View>
              {playHistory.length > 0 && (
                <Pressable onPress={clearPlayHistory}>
                  <Text style={[styles.clearText, { color: theme.danger }]}>مسح السجل</Text>
                </Pressable>
              )}
            </View>
            <Text style={[styles.storageSub, { color: theme.textSecondary }]}>
              يعرض آخر {displayedTracks.length} زامل استمعت إليها مؤخراً للعودة إليها بسرعة.
            </Text>
          </View>
        )}

        {/* عرض قوائم التشغيل المخصصة */}
        {segment === 'playlists' ? (
          <View style={styles.playlistsWrap}>
            <View style={styles.createPlRow}>
              <TextInput
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="أنشئ قائمة تشغيل جديدة..."
                placeholderTextColor={theme.textMuted}
                onSubmitEditing={() => {
                  createPlaylist(newPlaylistName);
                  setNewPlaylistName('');
                }}
                style={[
                  styles.plInput,
                  { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary },
                ]}
              />
              <Pressable
                onPress={() => {
                  createPlaylist(newPlaylistName);
                  setNewPlaylistName('');
                }}
                style={[styles.plCreateBtn, { backgroundColor: theme.accent }]}
              >
                <Icon name="plus" size={18} color={theme.accentText} />
              </Pressable>
            </View>

            {playlists.map((pl) => {
              const plTracks = pl.trackIds
                .map((id) => tracks.find((t) => t.id === id))
                .filter((t): t is NonNullable<typeof t> => Boolean(t));
              const expanded = expandedPlaylistId === pl.id;

              return (
                <View
                  key={pl.id}
                  style={[styles.plCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Pressable
                    onPress={() => setExpandedPlaylistId(expanded ? null : pl.id)}
                    style={styles.plCardHead}
                  >
                    <View style={[styles.plIconBox, { backgroundColor: theme.accentSoft }]}>
                      <Icon name="music" size={20} color={theme.accent} />
                    </View>
                    <View style={styles.plInfo}>
                      <Text style={[styles.plName, { color: theme.textPrimary }]}>{pl.name}</Text>
                      <Text style={[styles.plSub, { color: theme.textSecondary }]}>
                        {plTracks.length} مقطع صوتي
                      </Text>
                    </View>
                    <View style={styles.plBtns}>
                      {plTracks.length > 0 && (
                        <Pressable
                          onPress={(e: unknown) => {
                            (e as { stopPropagation?: () => void })?.stopPropagation?.();
                            void playTrack(plTracks[0].id, plTracks.map((t) => t.id));
                          }}
                          style={[styles.plPlayBtn, { backgroundColor: theme.accent }]}
                        >
                          <Icon name="play" size={15} color={theme.accentText} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={(e: unknown) => {
                          (e as { stopPropagation?: () => void })?.stopPropagation?.();
                          deletePlaylist(pl.id);
                        }}
                        style={styles.plDelBtn}
                      >
                        <Icon name="trash" size={17} color={theme.textMuted} />
                      </Pressable>
                    </View>
                  </Pressable>

                  {expanded && (
                    <View style={[styles.plExpanded, { borderTopColor: theme.border }]}>
                      {plTracks.length > 0 ? (
                        plTracks.map((track) => (
                          <TrackRow
                            key={track.id}
                            track={track}
                            theme={theme}
                            isCurrent={currentTrackId === track.id}
                            isPlaying={currentTrackId === track.id && isPlaying}
                            isFavorite={favorites.includes(track.id)}
                            isDownloaded={downloadedIds.includes(track.id)}
                            downloadProgress={downloadingIds[track.id]}
                            onPress={() => void playTrack(track.id, plTracks.map((t) => t.id))}
                            onLyricsPress={() => void playTrack(track.id, plTracks.map((t) => t.id), 'lyrics')}
                            onToggleFavorite={() => toggleFavorite(track.id)}
                            onDownloadPress={() =>
                              downloadedIds.includes(track.id)
                                ? removeDownload(track.id)
                                : downloadTrack(track.id)
                            }
                            onPlaylistPress={() => openPlaylistPicker(track.id)}
                          />
                        ))
                      ) : (
                        <Text style={[styles.emptyPlText, { color: theme.textMuted }]}>
                          القائمة فارغة — اضغط أيقونة القائمة بجانب أي مقطع لإضافته هنا.
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : displayedTracks.length > 0 ? (
          displayedTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              theme={theme}
              isCurrent={currentTrackId === track.id}
              isPlaying={currentTrackId === track.id && isPlaying}
              isFavorite={favorites.includes(track.id)}
              isDownloaded={downloadedIds.includes(track.id)}
              downloadProgress={downloadingIds[track.id]}
              onPress={() => void playTrack(track.id, displayedIds)}
              onLyricsPress={() => void playTrack(track.id, displayedIds, 'lyrics')}
              onToggleFavorite={() => toggleFavorite(track.id)}
              onDownloadPress={() =>
                downloadedIds.includes(track.id)
                  ? removeDownload(track.id)
                  : downloadTrack(track.id)
              }
              onPlaylistPress={() => openPlaylistPicker(track.id)}
            />
          ))
        ) : (
          <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Icon
              name={segment === 'favorites' ? 'heart-outline' : segment === 'history' ? 'clock' : 'music'}
              size={34}
              color={theme.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {segment === 'favorites'
                ? 'لا توجد مقاطع في المفضلة بعد'
                : segment === 'history'
                  ? 'سجل الاستماع فارغ حالياً'
                  : 'لا توجد مقاطع متاحة بعد'}
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              {segment === 'favorites'
                ? 'اضغط على أيقونة القلب بجانب أي مقطع لحفظه في مفضلتك.'
                : 'اضغط على أيقونة التحميل بجانب أي مقطع للاستماع إليه بدون إنترنت.'}
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontFamily: FONTS.ui,
    fontSize: 21,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
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
    fontWeight: '700',
  },
  segmentWrap: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  segmentBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  segLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollBody: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  storageCard: {
    padding: 13,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  storageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  storageTitle: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
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
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  playlistsWrap: {
    gap: 10,
  },
  createPlRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  plInput: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    textAlign: 'right',
  },
  plCreateBtn: {
    width: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  plCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 11,
  },
  plIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plInfo: {
    flex: 1,
    gap: 2,
  },
  plName: {
    fontFamily: FONTS.ui,
    fontSize: 14.5,
    fontWeight: '700',
  },
  plSub: {
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  plBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plDelBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plExpanded: {
    borderTopWidth: 1,
    padding: 10,
  },
  emptyPlText: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 38,
    paddingHorizontal: 20,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 8,
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
});

