import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import {
  extractMatchingSnippet,
  normalizeArabic,
  tokenizeArabicQuery,
} from '@shared/arabic/normalize';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { TrackRow } from '../components/TrackRow';
import { Icon } from '../components/Icon';
import { InlineAdSlot } from '../components/InlineAdSlot';

interface SearchScreenProps {
  theme: ThemePalette;
}

const SUGGESTIONS = ['اليمن', 'المندب', 'الجوف', 'الهداية', 'الثبات', 'الوعد', 'الصف'];

export const SearchScreen: React.FC<SearchScreenProps> = React.memo(({ theme }) => {
  const {
    tracks,
    currentTrackId,
    isPlaying,
    favorites,
    downloadedIds,
    downloadingIds,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    playTrack,
    toggleFavorite,
    downloadTrack,
    removeDownload,
    openPlaylistPicker,
  } = useAppStore(
    useShallow((s) => ({
      tracks: s.tracks,
      currentTrackId: s.currentTrackId,
      isPlaying: s.isPlaying,
      favorites: s.favorites,
      downloadedIds: s.downloadedIds,
      downloadingIds: s.downloadingIds,
      recentSearches: s.recentSearches,
      addRecentSearch: s.addRecentSearch,
      clearRecentSearches: s.clearRecentSearches,
      playTrack: s.playTrack,
      toggleFavorite: s.toggleFavorite,
      downloadTrack: s.downloadTrack,
      removeDownload: s.removeDownload,
      openPlaylistPicker: s.openPlaylistPicker,
    }))
  );

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(30);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      setVisibleLimit(30);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
      setVisibleLimit(30);
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  // محرك البحث العربي الفوري (Offline Instant Search مع التطبيع وتجاهل التشكيل والهمزات)
  const searchResults = useMemo(() => {
    const tokens = tokenizeArabicQuery(debouncedQuery);
    if (tokens.length === 0) return [];

    return tracks
      .map((track) => {
        const titleNorm = track.titleNormalized || normalizeArabic(track.title);
        const poetNorm = normalizeArabic(track.poet);
        const catNorm = normalizeArabic(track.category);
        const lyricsNorm = track.lyricsNormalized || normalizeArabic(track.lyrics);

        let score = 0;
        let matchedAll = true;

        for (const token of tokens) {
          let tokenHit = false;
          if (titleNorm.includes(token)) {
            score += 6;
            tokenHit = true;
          }
          if (poetNorm.includes(token) || catNorm.includes(token)) {
            score += 3;
            tokenHit = true;
          }
          if (lyricsNorm.includes(token)) {
            score += 2;
            tokenHit = true;
          }
          if (!tokenHit) {
            matchedAll = false;
            break;
          }
        }

        if (!matchedAll || score === 0) return null;

        const snippet = extractMatchingSnippet(track.lyrics, debouncedQuery, 1);
        return { track, score, snippet };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.score - a.score);
  }, [tracks, debouncedQuery]);

  const visibleResults = useMemo(
    () => searchResults.slice(0, visibleLimit),
    [searchResults, visibleLimit]
  );

  const popularTracks = useMemo(
    () => [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 4),
    [tracks]
  );

  const resultIds = useMemo(() => searchResults.map((r) => r.track.id), [searchResults]);

  const applySearch = (term: string) => {
    setQuery(term);
    addRecentSearch(term);
  };

  return (
    <View style={styles.root}>
      {/* شريط البحث الذكي */}
      <View style={styles.searchHeader}>
        <Text style={[styles.heading, { color: theme.textPrimary }]}>البحث الذكي</Text>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: theme.surface, borderColor: query ? theme.accent : theme.border },
          ]}
        >
          <Icon name="search" size={19} color={query ? theme.accent : theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => addRecentSearch(query)}
            placeholder="ابحث بالاسم أو بأي كلمة من الأبيات..."
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.textPrimary }]}
            accessibilityLabel="حقل البحث في المقاطع والكلمات"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <Icon name="close" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        <View style={styles.smartHint}>
          <Icon name="sparkles" size={13} color={theme.emerald} />
          <Text style={[styles.smartHintText, { color: theme.textSecondary }]}>
            يعمل أوفلاين • يبحث داخل العناوين والكلمات ويتجاهل التشكيل والهمزات تلقائياً
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
        <InlineAdSlot theme={theme} label="إعلان مموّل • Start.io" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {query.trim().length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              نتائج البحث ({searchResults.length})
            </Text>

            {visibleResults.length > 0 ? (
              <>
                {visibleResults.map(({ track, snippet }) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    theme={theme}
                    snippet={snippet}
                    isCurrent={currentTrackId === track.id}
                    isPlaying={currentTrackId === track.id && isPlaying}
                    isFavorite={favorites.includes(track.id)}
                    isDownloaded={downloadedIds.includes(track.id)}
                    downloadProgress={downloadingIds[track.id]}
                    onPress={() => {
                      addRecentSearch(query);
                      void playTrack(track.id, resultIds);
                    }}
                    onLyricsPress={() => {
                      addRecentSearch(query);
                      void playTrack(track.id, resultIds, 'lyrics');
                    }}
                    onToggleFavorite={() => toggleFavorite(track.id)}
                    onDownloadPress={() =>
                      downloadedIds.includes(track.id)
                        ? removeDownload(track.id)
                        : downloadTrack(track.id)
                    }
                    onPlaylistPress={() => openPlaylistPicker(track.id)}
                  />
                ))}
                {searchResults.length > visibleLimit && (
                  <Pressable
                    onPress={() => setVisibleLimit((n) => n + 30)}
                    style={{
                      alignSelf: 'center',
                      paddingHorizontal: 18,
                      paddingVertical: 9,
                      borderRadius: RADIUS.full,
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      borderWidth: 1,
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: '700', color: theme.accent }}>
                      عرض المزيد ({searchResults.length - visibleLimit} نتيجة متبقية)
                    </Text>
                  </Pressable>
                )}
              </>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Icon name="search" size={32} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  لا توجد نتائج مطابقة لـ «{query}»
                </Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  جرّب البحث بكلمة واحدة من الأبيات أو باسم التصنيف (مثل: زوامل، الفجر، الكرامة).
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* عمليات البحث الأخيرة */}
            {recentSearches.length > 0 && (
              <View style={styles.block}>
                <View style={styles.blockHead}>
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>عمليات البحث الأخيرة</Text>
                  <Pressable onPress={clearRecentSearches}>
                    <Text style={[styles.clearAll, { color: theme.textMuted }]}>مسح الكل</Text>
                  </Pressable>
                </View>
                <View style={styles.chipsWrap}>
                  {recentSearches.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => applySearch(item)}
                      style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      <Icon name="clock" size={13} color={theme.textMuted} />
                      <Text style={[styles.chipText, { color: theme.textPrimary }]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* اقتراحات البحث داخل الكلمات */}
            <View style={styles.block}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                جرّب البحث داخل الكلمات
              </Text>
              <View style={styles.chipsWrap}>
                {SUGGESTIONS.map((word) => (
                  <Pressable
                    key={word}
                    onPress={() => applySearch(word)}
                    style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: 'transparent' }]}
                  >
                    <Text style={[styles.chipText, { color: theme.accent }]}>#{word}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* الأكثر استماعاً */}
            <View style={styles.block}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>الأكثر استماعاً</Text>
              {popularTracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  theme={theme}
                  isCurrent={currentTrackId === track.id}
                  isPlaying={currentTrackId === track.id && isPlaying}
                  isFavorite={favorites.includes(track.id)}
                  isDownloaded={downloadedIds.includes(track.id)}
                  downloadProgress={downloadingIds[track.id]}
                  onPress={() => void playTrack(track.id, popularTracks.map((t) => t.id))}
                  onLyricsPress={() => void playTrack(track.id, popularTracks.map((t) => t.id), 'lyrics')}
                  onToggleFavorite={() => toggleFavorite(track.id)}
                  onDownloadPress={() =>
                    downloadedIds.includes(track.id)
                      ? removeDownload(track.id)
                      : downloadTrack(track.id)
                  }
                  onPlaylistPress={() => openPlaylistPicker(track.id)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  searchHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  heading: {
    fontFamily: FONTS.ui,
    fontSize: 21,
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.ui,
    fontSize: 14,
    textAlign: 'right',
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smartHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smartHintText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 16,
  },
  block: {
    gap: 10,
  },
  blockHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: FONTS.ui,
    fontSize: 14.5,
    fontWeight: '700',
  },
  clearAll: {
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 20,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FONTS.ui,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 20,
  },
});

