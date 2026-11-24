import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Track } from '@shared/types/track';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { formatDuration, formatFileSize } from '../utils/format';
import { TrackCover } from './TrackCover';
import { Icon } from './Icon';

interface FullPlayerModalProps {
  theme: ThemePalette;
}

const SLEEP_OPTIONS = [
  { label: 'إيقاف', minutes: null },
  { label: '10 د', minutes: 10 },
  { label: '20 د', minutes: 20 },
  { label: '30 د', minutes: 30 },
  { label: '60 د', minutes: 60 },
];

export const FullPlayerModal: React.FC<FullPlayerModalProps> = ({ theme }) => {
  const {
    isPlayerOpen,
    playerInitialTab,
    closePlayer,
    tracks,
    currentTrackId,
    queueIds,
    isPlaying,
    isBuffering,
    positionSec,
    durationSec,
    playbackRate,
    shuffle,
    repeatMode,
    sleepTimerEndsAt,
    favorites,
    downloadedIds,
    downloadingIds,
    lyricsFontSize,
    togglePlayPause,
    playNext,
    playPrevious,
    playTrack,
    seekTo,
    skipBy,
    cyclePlaybackRate,
    toggleShuffle,
    cycleRepeatMode,
    setSleepTimerMinutes,
    toggleFavorite,
    downloadTrack,
    removeDownload,
    setLyricsFontSize,
    openLyricsShare,
    openPlaylistPicker,
    showToast,
  } = useAppStore();

  const [tab, setTab] = useState<'player' | 'lyrics' | 'queue'>(playerInitialTab);
  const [showSleepBar, setShowSleepBar] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (isPlayerOpen) {
      setTab(playerInitialTab);
    }
  }, [isPlayerOpen, playerInitialTab]);

  useEffect(() => {
    if (!sleepTimerEndsAt) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sleepTimerEndsAt]);

  const track: Track | undefined = useMemo(
    () => tracks.find((t) => t.id === currentTrackId),
    [tracks, currentTrackId]
  );

  // توليد أعمدة موجة صوتية ثابتة لكل مقطع (44 عموداً)
  const waveBars = useMemo(() => {
    const seed = track?.sourceMessageId ?? 100;
    return Array.from({ length: 44 }, (_, i) => {
      const n = Math.sin((i + 1) * 0.58 + seed * 0.13) * 0.5 + 0.5;
      const m = Math.cos((i + 3) * 0.27 + seed * 0.07) * 0.35 + 0.65;
      return Math.round(18 + n * m * 82);
    });
  }, [track?.sourceMessageId]);

  if (!isPlayerOpen || !track) return null;

  const isFavorite = favorites.includes(track.id);
  const isDownloaded = downloadedIds.includes(track.id);
  const dlProgress = downloadingIds[track.id];
  const progressRatio = durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;
  const remainingSleepMin =
    sleepTimerEndsAt && sleepTimerEndsAt > nowTick
      ? Math.ceil((sleepTimerEndsAt - nowTick) / 60000)
      : null;

  const lyricsLines = (track.lyrics || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const handleCopyLyrics = async () => {
    if (!track.lyrics) return;
    try {
      await navigator.clipboard.writeText(`${track.title}\n— عيسى الليث\n\n${track.lyrics}`);
      showToast('تم نسخ الكلمات إلى الحافظة', 'success');
    } catch {
      showToast('تعذّر النسخ التلقائي — يمكنك التحديد والنسخ يدوياً', 'info');
    }
  };

  return (
    <View
      style={[
        styles.overlayRoot,
        {
          backgroundColor: theme.bg,
          backgroundImage: `linear-gradient(175deg, ${track.palette.primary} 0%, ${theme.bg} 46%, ${theme.bg} 100%)`,
        },
      ]}
    >
      {/* الشريط العلوي */}
      <View style={styles.topBar}>
        <Pressable onPress={closePlayer} style={styles.topIconBtn} accessibilityLabel="تصغير المشغل">
          <Icon name="chevron-down" size={24} color={theme.textPrimary} />
        </Pressable>

        <View style={styles.topCenter}>
          <Text style={[styles.topSource, { color: theme.accent }]}>
            {track.storageProvider === 'local'
              ? 'ملف MP3 محلي'
              : `قناة @${track.sourceChannel}`}
          </Text>
          <Text style={[styles.topCategory, { color: theme.textSecondary }]}>
            {track.category} • {formatFileSize(track.fileSizeBytes)}
          </Text>
        </View>

        <Pressable
          onPress={() => openPlaylistPicker(track.id)}
          style={styles.topIconBtn}
          accessibilityLabel="إضافة لقائمة تشغيل"
        >
          <Icon name="playlist" size={21} color={theme.textPrimary} />
        </Pressable>
      </View>

      {/* مبدّل الأوضاع: المشغّل | الكلمات | قائمة الانتظار */}
      <View style={styles.tabSwitchWrap}>
        <View style={[styles.tabSwitch, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}>
          {(
            [
              { id: 'player', label: 'المشغّل' },
              { id: 'lyrics', label: 'الكلمات' },
              { id: 'queue', label: `القائمة (${queueIds.length})` },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[
                  styles.tabSwitchBtn,
                  active && { backgroundColor: theme.accent },
                ]}
              >
                <Text
                  style={[
                    styles.tabSwitchLabel,
                    { color: active ? theme.accentText : theme.textSecondary },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 1) وضع المشغّل الكامل */}
      {tab === 'player' && (
        <ScrollView
          style={styles.flexScroll}
          contentContainerStyle={styles.playerBody}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.artworkArea}>
            <View
              style={[
                styles.artworkHalo,
                {
                  shadowColor: track.palette.accent,
                  shadowOffset: { width: 0, height: 14 },
                  shadowOpacity: 0.32,
                  shadowRadius: 34,
                },
              ]}
            >
              <TrackCover
                palette={track.palette}
                size={224}
                borderRadius={28}
                isCurrent
                isPlaying={isPlaying}
                titleInitial={track.title.charAt(0)}
              />
            </View>
          </View>

          {/* العنوان والشاعر والمفضلة */}
          <View style={styles.trackHeaderRow}>
            <View style={styles.trackTitleCol}>
              <Text style={[styles.trackTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                {track.title}
              </Text>
              <Text style={[styles.trackPoet, { color: theme.textSecondary }]} numberOfLines={1}>
                أداء: عيسى الليث {track.poet ? `• ${track.poet}` : ''}
              </Text>
            </View>

            <Pressable
              onPress={() => toggleFavorite(track.id)}
              style={[styles.circleActionBtn, { backgroundColor: theme.surface }]}
              accessibilityLabel="مفضلة"
            >
              <Icon
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorite ? theme.danger : theme.textSecondary}
              />
            </Pressable>
          </View>

          {/* الموجة الصوتية التفاعلية القابلة للنقر والتقديم */}
          <View style={styles.waveSection}>
            <View style={styles.waveRow}>
              {waveBars.map((heightPct, idx) => {
                const barRatio = (idx + 1) / waveBars.length;
                const filled = barRatio <= progressRatio;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => seekTo((idx / waveBars.length) * (durationSec || track.durationSec))}
                    style={styles.waveBarHit}
                    accessibilityLabel={`الانتقال إلى ${Math.round(barRatio * 100)}%`}
                  >
                    <View
                      style={[
                        styles.waveBar,
                        {
                          height: `${heightPct}%`,
                          backgroundColor: filled ? theme.accent : theme.borderStrong,
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.timeRow}>
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                {formatDuration(positionSec)}
              </Text>
              <Text style={[styles.timeText, { color: theme.textMuted }]}>
                {formatDuration(durationSec || track.durationSec)}
              </Text>
            </View>
          </View>

          {/* أزرار التحكم الرئيسية */}
          <View style={styles.mainControls}>
            <Pressable onPress={toggleShuffle} style={styles.smallCtrlBtn} accessibilityLabel="عشوائي">
              <Icon
                name="shuffle"
                size={20}
                color={shuffle ? theme.accent : theme.textMuted}
              />
            </Pressable>

            <Pressable onPress={() => void playPrevious()} style={styles.medCtrlBtn} accessibilityLabel="السابق">
              <Icon name="prev" size={24} color={theme.textPrimary} />
            </Pressable>

            <Pressable onPress={() => skipBy(-10)} style={styles.smallCtrlBtn} accessibilityLabel="ترجيع 10 ثوان">
              <Icon name="back10" size={21} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              onPress={() => void togglePlayPause()}
              style={[
                styles.bigPlayBtn,
                {
                  backgroundColor: theme.accent,
                  shadowColor: theme.accent,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 18,
                },
              ]}
              accessibilityLabel={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isBuffering ? (
                <ActivityIndicator size="small" color={theme.accentText} />
              ) : (
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={30}
                  color={theme.accentText}
                />
              )}
            </Pressable>

            <Pressable onPress={() => skipBy(10)} style={styles.smallCtrlBtn} accessibilityLabel="تقديم 10 ثوان">
              <Icon name="forward10" size={21} color={theme.textSecondary} />
            </Pressable>

            <Pressable onPress={() => void playNext()} style={styles.medCtrlBtn} accessibilityLabel="التالي">
              <Icon name="next" size={24} color={theme.textPrimary} />
            </Pressable>

            <Pressable onPress={cycleRepeatMode} style={styles.smallCtrlBtn} accessibilityLabel="تكرار">
              <Icon
                name={repeatMode === 'one' ? 'repeat-one' : 'repeat'}
                size={20}
                color={repeatMode !== 'off' ? theme.accent : theme.textMuted}
              />
            </Pressable>
          </View>

          {isBuffering && (
            <Text style={[styles.bufferingHint, { color: theme.accent }]}>
              جاري تجهيز البث الصوتي...
            </Text>
          )}

          {/* شريط الأدوات الاحترافي: السرعة، مؤقت النوم، التحميل أوفلاين، بطاقة الأبيات */}
          <View style={[styles.utilityBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable onPress={cyclePlaybackRate} style={styles.utilityBtn}>
              <Icon name="speed" size={18} color={playbackRate !== 1 ? theme.accent : theme.textSecondary} />
              <Text style={[styles.utilityLabel, { color: playbackRate !== 1 ? theme.accent : theme.textSecondary }]}>
                {playbackRate}x
              </Text>
            </Pressable>

            <Pressable onPress={() => setShowSleepBar((v) => !v)} style={styles.utilityBtn}>
              <Icon name="clock" size={18} color={remainingSleepMin ? theme.accent : theme.textSecondary} />
              <Text style={[styles.utilityLabel, { color: remainingSleepMin ? theme.accent : theme.textSecondary }]}>
                {remainingSleepMin ? `${remainingSleepMin} د` : 'مؤقت'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => (isDownloaded ? removeDownload(track.id) : downloadTrack(track.id))}
              style={styles.utilityBtn}
            >
              <Icon
                name={isDownloaded ? 'check-circle' : 'download'}
                size={18}
                color={isDownloaded ? theme.emerald : theme.textSecondary}
              />
              <Text style={[styles.utilityLabel, { color: isDownloaded ? theme.emerald : theme.textSecondary }]}>
                {dlProgress !== undefined ? `${dlProgress}%` : isDownloaded ? 'أوفلاين' : 'تحميل'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => openLyricsShare(track.id)}
              style={styles.utilityBtn}
            >
              <Icon name="sparkles" size={18} color={theme.accent} />
              <Text style={[styles.utilityLabel, { color: theme.accent }]}>بطاقة أبيات</Text>
            </Pressable>
          </View>

          {/* شريط اختيار مؤقت النوم */}
          {showSleepBar && (
            <View style={[styles.sleepPicker, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <Text style={[styles.sleepTitle, { color: theme.textSecondary }]}>مؤقت الإيقاف التلقائي:</Text>
              <View style={styles.sleepChips}>
                {SLEEP_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.label}
                    onPress={() => {
                      setSleepTimerMinutes(opt.minutes);
                      setShowSleepBar(false);
                    }}
                    style={[styles.sleepChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <Text style={[styles.sleepChipText, { color: theme.textPrimary }]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* بطاقة معاينة سريعة للكلمات لفتحها بلمسة واحدة */}
          {lyricsLines.length > 0 && (
            <Pressable
              onPress={() => setTab('lyrics')}
              style={[styles.lyricsPreviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.lyricsPreviewHead}>
                <View style={styles.rowCenterGap}>
                  <Icon name="lyrics" size={16} color={theme.accent} />
                  <Text style={[styles.lyricsPreviewTitle, { color: theme.accent }]}>الكلمات</Text>
                </View>
                <Text style={[styles.lyricsPreviewCta, { color: theme.textSecondary }]}>عرض الكل ←</Text>
              </View>
              <Text style={[styles.lyricsPreviewLines, { color: theme.textPrimary }]} numberOfLines={3}>
                {lyricsLines.slice(0, 3).join('\n')}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* 2) وضع الكلمات الغامر */}
      {tab === 'lyrics' && (
        <View style={styles.flexScroll}>
          <View style={[styles.lyricsToolbar, { borderBottomColor: theme.border }]}>
            <View style={styles.rowCenterGap}>
              <Pressable
                onPress={() => setLyricsFontSize(lyricsFontSize - 2)}
                style={[styles.fontBtn, { backgroundColor: theme.surface }]}
              >
                <Text style={[styles.fontBtnText, { color: theme.textPrimary }]}>أ-</Text>
              </Pressable>
              <Pressable
                onPress={() => setLyricsFontSize(lyricsFontSize + 2)}
                style={[styles.fontBtn, { backgroundColor: theme.surface }]}
              >
                <Text style={[styles.fontBtnText, { color: theme.textPrimary }]}>أ+</Text>
              </Pressable>
            </View>

            <View style={styles.rowCenterGap}>
              <Pressable
                onPress={() => void handleCopyLyrics()}
                style={[styles.lyricsToolPill, { backgroundColor: theme.surface }]}
              >
                <Icon name="copy" size={15} color={theme.textPrimary} />
                <Text style={[styles.lyricsToolText, { color: theme.textPrimary }]}>نسخ</Text>
              </Pressable>

              <Pressable
                onPress={() => openLyricsShare(track.id)}
                style={[styles.lyricsToolPill, { backgroundColor: theme.accent }]}
              >
                <Icon name="sparkles" size={15} color={theme.accentText} />
                <Text style={[styles.lyricsToolText, { color: theme.accentText }]}>تصميم بطاقة</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.flexScroll}
            contentContainerStyle={styles.lyricsContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.lyricsSongHeader, { color: theme.accent }]}>{track.title}</Text>
            {track.poet && (
              <Text style={[styles.lyricsPoetHeader, { color: theme.textSecondary }]}>
                {track.poet}
              </Text>
            )}

            {lyricsLines.length > 0 ? (
              <View style={styles.versesWrap}>
                {lyricsLines.map((line, i) => (
                  <Text
                    key={i}
                    selectable
                    style={[
                      styles.verseLine,
                      {
                        color: theme.textPrimary,
                        fontSize: lyricsFontSize,
                        lineHeight: Math.round(lyricsFontSize * 1.95),
                      },
                    ]}
                  >
                    {line}
                  </Text>
                ))}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Icon name="lyrics" size={34} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  لم تُرفق كلمات لهذا المقطع في القناة بعد.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* شريط تحكم مصغر أسفل الكلمات */}
          <View style={[styles.lyricsFooterPlay, { backgroundColor: theme.surfaceGlass, borderTopColor: theme.border }]}>
            <Text style={[styles.timeText, { color: theme.textSecondary }]}>
              {formatDuration(positionSec)} / {formatDuration(durationSec || track.durationSec)}
            </Text>
            <View style={styles.rowCenterGap}>
              <Pressable onPress={() => void playPrevious()} style={styles.smallCtrlBtn}>
                <Icon name="prev" size={20} color={theme.textPrimary} />
              </Pressable>
              <Pressable
                onPress={() => void togglePlayPause()}
                style={[styles.miniPlayCircle, { backgroundColor: theme.accent }]}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} size={20} color={theme.accentText} />
              </Pressable>
              <Pressable onPress={() => void playNext()} style={styles.smallCtrlBtn}>
                <Icon name="next" size={20} color={theme.textPrimary} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 3) قائمة الانتظار */}
      {tab === 'queue' && (
        <ScrollView
          style={styles.flexScroll}
          contentContainerStyle={styles.queueContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.queueHeading, { color: theme.textSecondary }]}>
            التالي في التشغيل ({queueIds.length} مقطع)
          </Text>
          {queueIds.map((id, idx) => {
            const qTrack = tracks.find((t) => t.id === id);
            if (!qTrack) return null;
            const active = qTrack.id === track.id;
            return (
              <Pressable
                key={qTrack.id}
                onPress={() => void playTrack(qTrack.id)}
                style={[
                  styles.queueRow,
                  {
                    backgroundColor: active ? theme.accentSoft : theme.surface,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text style={[styles.queueNum, { color: active ? theme.accent : theme.textMuted }]}>
                  {idx + 1}
                </Text>
                <TrackCover
                  palette={qTrack.palette}
                  size={42}
                  borderRadius={10}
                  isCurrent={active}
                  isPlaying={active && isPlaying}
                />
                <View style={styles.queueMeta}>
                  <Text
                    style={[styles.queueTitle, { color: active ? theme.accent : theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {qTrack.title}
                  </Text>
                  <Text style={[styles.queueSub, { color: theme.textSecondary }]} numberOfLines={1}>
                    {qTrack.category} • {formatDuration(qTrack.durationSec)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    flexDirection: 'column',
  },
  flexScroll: {
    flex: 1,
    minHeight: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  topIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topCenter: {
    alignItems: 'center',
    gap: 2,
  },
  topSource: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  topCategory: {
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  tabSwitchWrap: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  tabSwitch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  tabSwitchBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  tabSwitchLabel: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '700',
  },
  playerBody: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
  },
  artworkArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  artworkHalo: {
    borderRadius: 28,
  },
  trackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  trackTitleCol: {
    flex: 1,
    gap: 4,
  },
  trackTitle: {
    fontFamily: FONTS.ui,
    fontSize: 21,
    fontWeight: '700',
  },
  trackPoet: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
  },
  circleActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveSection: {
    gap: 8,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    gap: 2.5,
  },
  waveBarHit: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveBar: {
    width: '72%',
    minWidth: 2.5,
    borderRadius: 99,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '600',
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  smallCtrlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medCtrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigPlayBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingHint: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    textAlign: 'center',
  },
  utilityBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  utilityBtn: {
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  utilityLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '600',
  },
  sleepPicker: {
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 8,
  },
  sleepTitle: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '600',
  },
  sleepChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sleepChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  sleepChipText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '600',
  },
  lyricsPreviewCard: {
    padding: 15,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 8,
  },
  lyricsPreviewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowCenterGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lyricsPreviewTitle: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  lyricsPreviewCta: {
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  lyricsPreviewLines: {
    fontFamily: FONTS.lyrics,
    fontSize: 18,
    lineHeight: 32,
  },
  lyricsToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  fontBtn: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  fontBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  lyricsToolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  lyricsToolText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  lyricsContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 36,
    alignItems: 'center',
  },
  lyricsSongHeader: {
    fontFamily: FONTS.ui,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  lyricsPoetHeader: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  versesWrap: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  verseLine: {
    fontFamily: FONTS.lyrics,
    textAlign: 'center',
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
  },
  lyricsFooterPlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  miniPlayCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 28,
  },
  queueHeading: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 10,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  queueNum: {
    width: 22,
    textAlign: 'center',
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  queueMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  queueTitle: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    fontWeight: '600',
  },
  queueSub: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
  },
});

