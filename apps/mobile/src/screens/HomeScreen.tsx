import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import type { TrackCategory } from '@shared/types/track';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { formatDuration, formatPlayCount, formatRelativeArabicDate } from '../utils/format';
import { TrackCover } from '../components/TrackCover';
import { TrackRow } from '../components/TrackRow';
import { Icon } from '../components/Icon';

interface HomeScreenProps {
  theme: ThemePalette;
}

type SortMode = 'newest' | 'popular' | 'oldest' | 'alpha';

const SORT_OPTIONS: Array<{ id: SortMode; label: string }> = [
  { id: 'newest', label: 'الأحدث' },
  { id: 'popular', label: 'الأكثر استماعاً' },
  { id: 'oldest', label: 'الأقدم' },
  { id: 'alpha', label: 'الأبجدي' },
];

function isCleanPoetryLine(line: string): boolean {
  const s = line.trim();
  if (s.length < 6) return false;
  if (/(https?:\/\/|www\.|x\.com|t\.me|mmy\.ye|twitter\.com|youtu\.be|youtube\.com|@[a-z0-9_]+)/i.test(s)) {
    return false;
  }
  if (/^[\s\-_=•*#]+$/.test(s)) return false;
  return true;
}

const CATEGORIES: Array<TrackCategory | 'الكل'> = [
  'الكل',
  'زوامل',
  'أناشيد',
  'قصائد',
  'تراثية',
  'مناسبات',
];

export const HomeScreen: React.FC<HomeScreenProps> = React.memo(({ theme }) => {
  const {
    tracks,
    selectedCategory,
    setSelectedCategory,
    currentTrackId,
    isPlaying,
    isBuffering,
    favorites,
    downloadedIds,
    downloadingIds,
    playProgress,
    isSyncing,
    connectionMode,
    lastSyncAt,
    toggleTheme,
    syncWithTelegramApi,
    playTrack,
    toggleFavorite,
    downloadTrack,
    removeDownload,
    openLyricsShare,
    openPlaylistPicker,
    syncError,
  } = useAppStore(
    useShallow((s) => ({
      tracks: s.tracks,
      selectedCategory: s.selectedCategory,
      setSelectedCategory: s.setSelectedCategory,
      currentTrackId: s.currentTrackId,
      isPlaying: s.isPlaying,
      isBuffering: s.isBuffering,
      favorites: s.favorites,
      downloadedIds: s.downloadedIds,
      downloadingIds: s.downloadingIds,
      playProgress: s.playProgress,
      isSyncing: s.isSyncing,
      connectionMode: s.connectionMode,
      lastSyncAt: s.lastSyncAt,
      toggleTheme: s.toggleTheme,
      syncWithTelegramApi: s.syncWithTelegramApi,
      playTrack: s.playTrack,
      toggleFavorite: s.toggleFavorite,
      downloadTrack: s.downloadTrack,
      removeDownload: s.removeDownload,
      openLyricsShare: s.openLyricsShare,
      openPlaylistPicker: s.openPlaylistPicker,
      syncError: s.syncError,
    }))
  );

  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const sortedAllTracks = useMemo(() => {
    const copy = [...tracks];
    copy.sort((a, b) => {
      const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.sourceMessageId || 0) - (a.sourceMessageId || 0);
    });
    return copy;
  }, [tracks]);

  const featuredTrack = sortedAllTracks[0];

  const filteredTracks = useMemo(() => {
    const base =
      selectedCategory === 'الكل'
        ? [...sortedAllTracks]
        : sortedAllTracks.filter((t) => t.category === selectedCategory);

    if (sortMode === 'popular') {
      base.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    } else if (sortMode === 'oldest') {
      base.reverse();
    } else if (sortMode === 'alpha') {
      base.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    }
    return base;
  }, [sortedAllTracks, selectedCategory, sortMode]);

  // عرض تدريجي فائق السلاسة مع حفظ عدد العناصر وموضع التمرير عند التبديل أو العودة للتطبيق
  const scrollRef = useRef<{ scrollTo?: (opts: { y: number; animated?: boolean }) => void } | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(() => {
    try {
      const saved = Number(sessionStorage.getItem('essa_home_visible_count') || 40);
      return Number.isFinite(saved) && saved >= 40 ? saved : 40;
    } catch {
      return 40;
    }
  });
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      try {
        const savedY = Number(sessionStorage.getItem('essa_home_scroll_y') || 0);
        if (savedY > 0) {
          setTimeout(() => {
            scrollRef.current?.scrollTo({ y: savedY, animated: false });
          }, 60);
        }
      } catch {
        // تجاهل
      }
      return;
    }
    setVisibleCount(40);
    try {
      sessionStorage.setItem('essa_home_visible_count', '40');
      sessionStorage.setItem('essa_home_scroll_y', '0');
    } catch {
      // تجاهل
    }
  }, [selectedCategory, sortMode]);

  const handleLoadMore = () => {
    setVisibleCount((c) => {
      const next = c + 50;
      try {
        sessionStorage.setItem('essa_home_visible_count', String(next));
      } catch {
        // تجاهل
      }
      return next;
    });
  };
  const visibleTracks = useMemo(
    () => filteredTracks.slice(0, visibleCount),
    [filteredTracks, visibleCount]
  );

  const continueListening = useMemo(() => {
    return sortedAllTracks.filter((t) => {
      const p = playProgress[t.id] || 0;
      return p > 3 && p < t.durationSec - 3;
    });
  }, [sortedAllTracks, playProgress]);

  const { dailyQuoteTrack, dailyQuoteLines } = useMemo(() => {
    for (const t of sortedAllTracks) {
      if (!t.hasLyrics || !t.lyrics) continue;
      const cleanLines = t.lyrics
        .split('\n')
        .map((l) => l.trim())
        .filter(isCleanPoetryLine);
      if (cleanLines.length >= 2) {
        return { dailyQuoteTrack: t, dailyQuoteLines: cleanLines.slice(0, 2) };
      }
    }
    return { dailyQuoteTrack: null, dailyQuoteLines: [] as string[] };
  }, [sortedAllTracks]);

  const filteredIds = useMemo(() => filteredTracks.map((t) => t.id), [filteredTracks]);

  return (
    <ScrollView
      ref={scrollRef as never}
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      onScroll={(e: { nativeEvent?: { contentOffset?: { y?: number } } }) => {
        try {
          const y = e?.nativeEvent?.contentOffset?.y;
          if (typeof y === 'number') {
            sessionStorage.setItem('essa_home_scroll_y', String(Math.round(y)));
          }
        } catch {
          // تجاهل
        }
      }}
    >
      {/* الترويسة الرئيسية */}
      <View style={styles.header}>
        <View style={styles.brandCol}>
          <Text style={[styles.appTitle, { color: theme.textPrimary }]}>زوامل عيسى الليث</Text>
          <View style={styles.syncStatusRow}>
            <View
              style={[
                styles.liveDot,
                { backgroundColor: connectionMode === 'live' ? theme.emerald : theme.danger },
              ]}
            />
            <Text style={[styles.syncStatusText, { color: theme.textSecondary }]}>
              {connectionMode === 'live'
                ? 'مكتبة الزوامل والأناشيد الكاملة'
                : 'الوضع المحلي (بدون إنترنت)'}
            </Text>
          </View>
        </View>

        <View style={styles.headerBtns}>
          <Pressable
            onPress={() => void syncWithTelegramApi()}
            style={[styles.iconCircle, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityLabel="مزامنة الآن"
          >
            <div
              style={{
                display: 'flex',
                animation: isSyncing ? 'spinSlow 0.9s linear infinite' : undefined,
              }}
            >
              <Icon name="sync" size={18} color={theme.accent} />
            </div>
          </Pressable>

          <Pressable
            onPress={toggleTheme}
            style={[styles.iconCircle, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityLabel="تبديل المظهر"
          >
            <Icon name={theme.mode === 'dark' ? 'sun' : 'moon'} size={18} color={theme.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* شاشة التحميل الأولى عند فتح التطبيق لأول مرة (بدون أي أغاني تجريبية!) */}
      {tracks.length === 0 && (
        <View style={[styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {isSyncing ? (
            <>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={[styles.loadingTitle, { color: theme.textPrimary }]}>
                جاري تحميل مكتبة عيسى الليث...
              </Text>
              <Text style={[styles.loadingSub, { color: theme.textSecondary }]}>
                يتم جلب أحدث الزوامل والكلمات مباشرة من قناة @IssaAllaith
              </Text>
            </>
          ) : (
            <>
              <Icon name="wifi-off" size={32} color={theme.textMuted} />
              <Text style={[styles.loadingTitle, { color: theme.textPrimary }]}>
                تعذّر جلب المكتبة حالياً
              </Text>
              <Text style={[styles.loadingSub, { color: theme.textSecondary }]}>
                {syncError || 'تحقّق من الاتصال بالإنترنت ثم أعد المحاولة.'}
              </Text>
              <Pressable
                onPress={() => void syncWithTelegramApi()}
                style={[styles.retryBtn, { backgroundColor: theme.accent }]}
              >
                <Icon name="sync" size={15} color={theme.accentText} />
                <Text style={[styles.retryBtnText, { color: theme.accentText }]}>إعادة المحاولة</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* بطاقة المقطع الأحدث (Hero Card) */}
      {featuredTrack && (
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: featuredTrack.palette.secondary,
              backgroundImage: `linear-gradient(135deg, ${featuredTrack.palette.primary} 0%, ${featuredTrack.palette.secondary} 100%)`,
              borderColor: 'rgba(226, 168, 75, 0.3)',
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={[styles.heroPill, { backgroundColor: 'rgba(226,168,75,0.2)' }]}>
              <Icon name="sparkles" size={13} color="#F2C16B" />
              <Text style={styles.heroPillText}>أحدث إصدار</Text>
            </View>
            <Text style={styles.heroDate}>
              {formatRelativeArabicDate(featuredTrack.publishedAt)}
            </Text>
          </View>

          <View style={styles.heroMain}>
            <TrackCover
              palette={featuredTrack.palette}
              coverUrl={featuredTrack.coverUrl}
              size={78}
              borderRadius={18}
              isCurrent={currentTrackId === featuredTrack.id}
              isPlaying={currentTrackId === featuredTrack.id && isPlaying && !isBuffering}
              isLoading={currentTrackId === featuredTrack.id && isBuffering}
              title={featuredTrack.title}
            />
            <View style={styles.heroMeta}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {featuredTrack.title}
              </Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {featuredTrack.category} • {formatDuration(featuredTrack.durationSec)} •{' '}
                {formatPlayCount(featuredTrack.playCount)} استماع
              </Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <Pressable
              onPress={() => void playTrack(featuredTrack.id, filteredIds, 'player')}
              style={[styles.heroPrimaryBtn, { backgroundColor: theme.accent }]}
            >
              <Icon
                name={currentTrackId === featuredTrack.id && isPlaying ? 'pause' : 'play'}
                size={17}
                color={theme.accentText}
              />
              <Text style={[styles.heroPrimaryText, { color: theme.accentText }]}>
                {currentTrackId === featuredTrack.id && isPlaying ? 'قيد التشغيل' : 'تشغيل الآن'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void playTrack(featuredTrack.id, filteredIds, 'lyrics')}
              style={styles.heroSecondaryBtn}
            >
              <Icon name="lyrics" size={16} color="#F4F6FA" />
              <Text style={styles.heroSecondaryText}>قراءة الكلمات</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* استكمل الاستماع */}
      {continueListening.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>استكمل الاستماع</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {continueListening.map((t) => {
              const saved = playProgress[t.id] || 0;
              const pct = Math.min(100, Math.round((saved / Math.max(1, t.durationSec)) * 100));
              return (
                <Pressable
                  key={t.id}
                  onPress={() => void playTrack(t.id)}
                  style={[styles.continueCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <TrackCover
                    palette={t.palette}
                    coverUrl={t.coverUrl}
                    size={46}
                    borderRadius={12}
                    isCurrent={currentTrackId === t.id}
                    isPlaying={currentTrackId === t.id && isPlaying && !isBuffering}
                    isLoading={currentTrackId === t.id && isBuffering}
                    title={t.title}
                  />
                  <View style={styles.continueMeta}>
                    <Text style={[styles.continueTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={[styles.continueTime, { color: theme.textSecondary }]}>
                      توقفت عند {formatDuration(saved)}
                    </Text>
                    <View style={[styles.continueBarBg, { backgroundColor: theme.border }]}>
                      <View style={[styles.continueBarFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* تصنيفات سريعة وقائمة المقاطع */}
      {tracks.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active ? theme.accent : theme.surface,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      { color: active ? theme.accentText : theme.textSecondary },
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* شريط الفرز (الافتراضي: الأحدث) */}
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((opt) => {
              const active = sortMode === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSortMode(opt.id)}
                  style={[
                    styles.sortChip,
                    {
                      backgroundColor: active ? theme.accentSoft : 'transparent',
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      { color: active ? theme.accent : theme.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                {selectedCategory === 'الكل' ? 'أحدث المقاطع' : `قسم ${selectedCategory}`} ({filteredTracks.length})
              </Text>
              {filteredTracks.length > 0 && (
                <Pressable
                  onPress={() => void playTrack(filteredTracks[0].id, filteredIds)}
                  style={styles.playAllBtn}
                >
                  <Icon name="play" size={13} color={theme.accent} />
                  <Text style={[styles.playAllText, { color: theme.accent }]}>تشغيل الكل</Text>
                </Pressable>
              )}
            </View>

            {visibleTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                theme={theme}
                isCurrent={currentTrackId === track.id}
                isPlaying={currentTrackId === track.id && isPlaying}
                isFavorite={favorites.includes(track.id)}
                isDownloaded={downloadedIds.includes(track.id)}
                downloadProgress={downloadingIds[track.id]}
                autoLoadCover={idx < 40}
                onPress={() => void playTrack(track.id, filteredIds)}
                onLyricsPress={() => void playTrack(track.id, filteredIds, 'lyrics')}
                onToggleFavorite={() => toggleFavorite(track.id)}
                onDownloadPress={() =>
                  downloadedIds.includes(track.id) ? removeDownload(track.id) : downloadTrack(track.id)
                }
                onPlaylistPress={() => openPlaylistPicker(track.id)}
              />
            ))}

            {visibleCount < filteredTracks.length && (
              <Pressable
                onPress={handleLoadMore}
                style={[styles.loadMoreBtn, { backgroundColor: theme.surface, borderColor: theme.borderStrong }]}
              >
                <Text style={[styles.loadMoreText, { color: theme.accent }]}>
                  عرض المزيد (المتبقي {filteredTracks.length - visibleCount} زامل)
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {/* بطاقة بيت مختار اليوم */}
      {dailyQuoteTrack && dailyQuoteLines.length > 0 && (
        <View
          style={[
            styles.quoteCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.accent,
            },
          ]}
        >
          <View style={styles.quoteHead}>
            <View style={styles.quoteHeadLeft}>
              <Icon name="sparkles" size={16} color={theme.accent} />
              <Text style={[styles.quoteTag, { color: theme.accent }]}>أبيات مختارة اليوم</Text>
            </View>
            <Text style={[styles.quoteSource, { color: theme.textMuted }]}>{dailyQuoteTrack.title}</Text>
          </View>

          <Text style={[styles.quoteVerses, { color: theme.textPrimary }]}>
            {dailyQuoteLines.join('\n')}
          </Text>

          <Pressable
            onPress={() => openLyricsShare(dailyQuoteTrack.id)}
            style={[styles.quoteShareBtn, { backgroundColor: theme.accentSoft }]}
          >
            <Icon name="share" size={15} color={theme.accent} />
            <Text style={[styles.quoteShareText, { color: theme.accent }]}>
              تصميم ومشاركة كبطاقة شعرية
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandCol: {
    gap: 3,
  },
  appTitle: {
    fontFamily: FONTS.ui,
    fontSize: 21,
    fontWeight: '700',
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncStatusText: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: 15,
    gap: 13,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  heroPillText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
    color: '#F2C16B',
  },
  heroDate: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: 'rgba(244,246,250,0.72)',
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  heroMeta: {
    flex: 1,
    gap: 5,
  },
  heroTitle: {
    fontFamily: FONTS.ui,
    fontSize: 18,
    fontWeight: '700',
    color: '#F7F9FC',
    lineHeight: 26,
  },
  heroSub: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: 'rgba(244,246,250,0.78)',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 9,
  },
  heroPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  heroPrimaryText: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    fontWeight: '700',
  },
  heroSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroSecondaryText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '600',
    color: '#F4F6FA',
  },
  loadingCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingVertical: 38,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  loadingTitle: {
    fontFamily: FONTS.ui,
    fontSize: 15.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingSub: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    marginTop: 4,
  },
  retryBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  loadMoreBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  loadMoreText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.ui,
    fontSize: 15.5,
    fontWeight: '700',
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playAllText: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '700',
  },
  hScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  continueCard: {
    width: 218,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  continueMeta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  continueTitle: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  continueTime: {
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  continueBarBg: {
    height: 3.5,
    borderRadius: 2,
    overflow: 'hidden',
  },
  continueBarFill: {
    height: '100%',
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    alignItems: 'center',
  },
  sortChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  sortChipText: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
    fontWeight: '600',
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  catChipText: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '600',
  },
  quoteCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  quoteHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quoteTag: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '700',
  },
  quoteSource: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
  },
  quoteVerses: {
    fontFamily: FONTS.lyrics,
    fontSize: 19,
    lineHeight: 35,
    textAlign: 'center',
    fontWeight: '700',
  },
  quoteShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  quoteShareText: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '700',
  },
});

