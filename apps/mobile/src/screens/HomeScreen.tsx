import React, { useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const CATEGORIES: Array<TrackCategory | 'الكل'> = [
  'الكل',
  'زوامل',
  'أناشيد',
  'قصائد',
  'تراثية',
  'مناسبات',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ theme }) => {
  const {
    tracks,
    selectedCategory,
    setSelectedCategory,
    currentTrackId,
    isPlaying,
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
    setActiveTab,
    importLocalAudioFile,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const featuredTrack = tracks[0];

  const filteredTracks = useMemo(() => {
    if (selectedCategory === 'الكل') return tracks;
    return tracks.filter((t) => t.category === selectedCategory);
  }, [tracks, selectedCategory]);

  const continueListening = useMemo(() => {
    return tracks.filter((t) => {
      const p = playProgress[t.id] || 0;
      return p > 3 && p < t.durationSec - 3;
    });
  }, [tracks, playProgress]);

  const dailyQuoteTrack = tracks[2] || tracks[0];
  const dailyQuoteLines = (dailyQuoteTrack?.lyrics || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2);

  const filteredIds = useMemo(() => filteredTracks.map((t) => t.id), [filteredTracks]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importLocalAudioFile(file);
    }
    e.target.value = '';
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* مدخل خفي لاستيراد ملف MP3 محلي للتجربة الفورية */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* الترويسة الرئيسية */}
      <View style={styles.header}>
        <View style={styles.brandCol}>
          <Text style={[styles.appTitle, { color: theme.textPrimary }]}>مكتبة عيسى الليث</Text>
          <View style={styles.syncStatusRow}>
            <View
              style={[
                styles.liveDot,
                { backgroundColor: connectionMode === 'live' ? theme.emerald : theme.accent },
              ]}
            />
            <Text style={[styles.syncStatusText, { color: theme.textSecondary }]}>
              {connectionMode === 'live'
                ? `متزامن مع @IssaAllaith • ${lastSyncAt ? formatRelativeArabicDate(lastSyncAt) : 'الآن'}`
                : `معاينة تفاعلية • قناة @IssaAllaith`}
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
              <Icon name="telegram" size={13} color="#F2C16B" />
              <Text style={styles.heroPillText}>الأحدث من القناة الرسمية</Text>
            </View>
            <Text style={styles.heroDate}>
              {formatRelativeArabicDate(featuredTrack.publishedAt)}
            </Text>
          </View>

          <View style={styles.heroMain}>
            <TrackCover
              palette={featuredTrack.palette}
              size={78}
              borderRadius={18}
              isCurrent={currentTrackId === featuredTrack.id}
              isPlaying={currentTrackId === featuredTrack.id && isPlaying}
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

      {/* شريط سريع في وضع المعاينة لتجربة MP3 حقيقي أو ربط تليجرام */}
      {connectionMode === 'preview' && (
        <View style={[styles.quickStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            onPress={() => fileInputRef.current?.click()}
            style={[styles.quickStripBtn, { backgroundColor: theme.accentSoft }]}
          >
            <Icon name="upload" size={15} color={theme.accent} />
            <Text style={[styles.quickStripBtnText, { color: theme.accent }]}>
              جرّب ملف MP3 من جهازك
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('settings')}
            style={[styles.quickStripBtn, { backgroundColor: theme.emeraldSoft }]}
          >
            <Icon name="telegram" size={15} color={theme.emerald} />
            <Text style={[styles.quickStripBtnText, { color: theme.emerald }]}>
              إعداد ربط تليجرام
            </Text>
          </Pressable>
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
                  <TrackCover palette={t.palette} size={46} borderRadius={12} />
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

      {/* تصنيفات سريعة */}
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

      {/* قائمة المقاطع */}
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

        {filteredTracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            theme={theme}
            isCurrent={currentTrackId === track.id}
            isPlaying={currentTrackId === track.id && isPlaying}
            isFavorite={favorites.includes(track.id)}
            isDownloaded={downloadedIds.includes(track.id)}
            downloadProgress={downloadingIds[track.id]}
            onPress={() => void playTrack(track.id, filteredIds)}
            onLyricsPress={() => void playTrack(track.id, filteredIds, 'lyrics')}
            onToggleFavorite={() => toggleFavorite(track.id)}
            onDownloadPress={() =>
              downloadedIds.includes(track.id) ? removeDownload(track.id) : downloadTrack(track.id)
            }
            onPlaylistPress={() => openPlaylistPicker(track.id)}
          />
        ))}
      </View>

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
};

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
  quickStrip: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  quickStripBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
  },
  quickStripBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
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

