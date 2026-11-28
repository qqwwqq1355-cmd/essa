import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Track } from '@shared/types/track';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { formatDuration, formatFileSize, formatPlayCount, formatRelativeArabicDate } from '../utils/format';
import { cleanLyricsLines } from '../utils/lyrics';
import { TrackCover } from './TrackCover';
import { Icon } from './Icon';
import { InlineAdSlot } from './InlineAdSlot';

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
    bufferedSec,
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
    playbackError,
    retryCurrentTrack,
    clearPlaybackError,
    showToast,
  } = useAppStore();

  const [tab, setTab] = useState<'player' | 'lyrics' | 'queue'>(playerInitialTab);
  const [showSleepBar, setShowSleepBar] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubSec, setScrubSec] = useState(0);

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

  if (!isPlayerOpen || !track) return null;

  const isFavorite = favorites.includes(track.id);
  const isDownloaded = downloadedIds.includes(track.id);
  const dlProgress = downloadingIds[track.id];
  const safeDuration = durationSec > 0 ? durationSec : track.durationSec || 0;
  const displayPos = isScrubbing ? scrubSec : positionSec;
  const progressRatio = safeDuration > 0 ? Math.min(1, Math.max(0, displayPos / safeDuration)) : 0;
  const bufferedRatio = safeDuration > 0 ? Math.min(1, Math.max(progressRatio, bufferedSec / safeDuration)) : 0;
  const remainingSec = Math.max(0, safeDuration - displayPos);
  const showPauseIcon = isPlaying || isBuffering;
  const remainingSleepMin =
    sleepTimerEndsAt && sleepTimerEndsAt > nowTick
      ? Math.ceil((sleepTimerEndsAt - nowTick) / 60000)
      : null;

  const lyricsLines = cleanLyricsLines(track.lyrics, track.title);

  const handleCopyLyrics = async () => {
    if (lyricsLines.length === 0) return;
    try {
      await navigator.clipboard.writeText(`${track.title}\n— عيسى الليث\n\n${lyricsLines.join('\n')}`);
      showToast('تم نسخ الكلمات إلى الحافظة', 'success');
    } catch {
      showToast('تعذّر النسخ التلقائي — يمكنك التحديد والنسخ يدوياً', 'info');
    }
  };

  const handleShareTrack = async () => {
    const shareText = [
      `🎵 ${track.title}`,
      track.poet ? `✍️ كلمات الشاعر: ${track.poet}` : null,
      '🎙️ أداء: عيسى الليث',
      track.streamUrl && !track.streamUrl.startsWith('blob:') ? `🔗 ${track.streamUrl}` : null,
      'عبر تطبيق زوامل عيسى الليث',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: track.title,
          text: shareText,
        });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      showToast('تم نسخ تفاصيل ورابط الزامل للمشاركة', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(shareText);
        showToast('تم نسخ تفاصيل ورابط الزامل للمشاركة', 'success');
      } catch {
        showToast('تعذّرت المشاركة حالياً', 'error');
      }
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
            {track.storageProvider === 'local' ? 'ملف MP3 محلي' : 'زوامل عيسى الليث'}
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

      {/* خانة إعلان Start.io أسفل شريط أزرار المشغّل والكلمات والقائمة */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
        <InlineAdSlot theme={theme} label="إعلان مموّل • Start.io" />
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
                coverUrl={track.coverUrl}
                size={224}
                borderRadius={28}
                isCurrent
                isPlaying={isPlaying && !isBuffering}
                isLoading={isBuffering}
                title={track.title}
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
                أداء: عيسى الليث {track.poet ? `• كلمات: ${track.poet}` : ''}
              </Text>
              <Text style={[styles.trackMetaLine, { color: theme.textMuted }]} numberOfLines={1}>
                {formatRelativeArabicDate(track.publishedAt)} • {formatPlayCount(track.playCount)} استماع
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

          {/* شريط التشغيل التفاعلي المتطور (قابل للسحب مثل Spotify و YouTube Music) */}
          <View style={styles.seekSection}>
            <View style={styles.seekBarWrap}>
              <View style={[styles.seekTrackBg, { backgroundColor: theme.borderStrong }]}>
                {isBuffering && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: `linear-gradient(90deg, transparent 0%, ${theme.accent} 50%, transparent 100%)`,
                      opacity: 0.65,
                      animation: 'pulseGlow 1.1s ease-in-out infinite',
                    }}
                  />
                )}
                <View
                  style={[
                    styles.seekBufferedFill,
                    { width: `${bufferedRatio * 100}%`, backgroundColor: theme.textMuted },
                  ]}
                />
                <View
                  style={[
                    styles.seekActiveFill,
                    { width: `${progressRatio * 100}%`, backgroundColor: theme.accent },
                  ]}
                />
              </View>
              <View
                style={[
                  styles.seekThumb,
                  {
                    left: `${progressRatio * 100}%`,
                    backgroundColor: theme.accent,
                    borderColor: theme.textPrimary,
                    transform: [{ translateX: -8 }, { scale: isScrubbing ? 1.25 : 1 }],
                  },
                ]}
              />
              {/* شريط سحب أصلي شفاف فوق الشريط المخصص لاستجابة فورية باللمس والماوس */}
              <input
                type="range"
                dir="ltr"
                min={0}
                max={safeDuration || 100}
                step={0.5}
                value={Math.min(displayPos, safeDuration || 100)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setIsScrubbing(true);
                  setScrubSec(val);
                }}
                onMouseUp={() => {
                  if (isScrubbing) {
                    seekTo(scrubSec);
                    setIsScrubbing(false);
                  }
                }}
                onTouchEnd={() => {
                  if (isScrubbing) {
                    seekTo(scrubSec);
                    setIsScrubbing(false);
                  }
                }}
                onKeyUp={() => {
                  if (isScrubbing) {
                    seekTo(scrubSec);
                    setIsScrubbing(false);
                  }
                }}
                aria-label="شريط التقديم والترجيع"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
            </View>

            <View style={styles.timeRow}>
              <Text style={[styles.timeText, { color: theme.textPrimary }]}>
                {formatDuration(displayPos)}
              </Text>
              <Text style={[styles.timeText, { color: theme.textMuted }]}>
                -{formatDuration(remainingSec)}
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
                  borderWidth: isBuffering ? 3 : 0,
                  borderColor: theme.textPrimary,
                },
              ]}
              accessibilityLabel={showPauseIcon ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              <Icon
                name={showPauseIcon ? 'pause' : 'play'}
                size={30}
                color={theme.accentText}
              />
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
            <View style={styles.bufferingRow}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.bufferingHint, { color: theme.accent }]}>
                جاري التحميل... يمكنك الإيقاف أو التبديل في أي لحظة
              </Text>
            </View>
          )}

          {playbackError && (
            <View
              style={[
                styles.sleepPicker,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.danger,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
            >
              <Text style={[styles.sleepTitle, { color: theme.danger, flex: 1 }]}>
                {playbackError.message}
              </Text>
              <Pressable
                onPress={() => {
                  clearPlaybackError();
                  void retryCurrentTrack();
                }}
                style={{
                  backgroundColor: theme.accent,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: RADIUS.sm,
                }}
              >
                <Text style={{ color: theme.accentText, fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: '700' }}>
                  إعادة المحاولة
                </Text>
              </Pressable>
            </View>
          )}

          {/* شريط الأدوات الاحترافي: السرعة، مؤقت النوم، التحميل أوفلاين، مشاركة الزامل، بطاقة الأبيات */}
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
              onPress={() => downloadTrack(track.id)}
              style={styles.utilityBtn}
            >
              <Icon
                name={isDownloaded ? 'check-circle' : 'download'}
                size={18}
                color={isDownloaded ? theme.emerald : theme.textSecondary}
              />
              <Text style={[styles.utilityLabel, { color: isDownloaded ? theme.emerald : theme.textSecondary }]}>
                {dlProgress !== undefined ? 'جاري الحفظ...' : isDownloaded ? 'حفظ MP3' : 'تحميل'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void handleShareTrack()}
              style={styles.utilityBtn}
            >
              <Icon name="share" size={18} color={theme.textSecondary} />
              <Text style={[styles.utilityLabel, { color: theme.textSecondary }]}>مشاركة</Text>
            </Pressable>

            <Pressable
              onPress={() => openLyricsShare(track.id)}
              style={styles.utilityBtn}
            >
              <Icon name="sparkles" size={18} color={theme.accent} />
              <Text style={[styles.utilityLabel, { color: theme.accent }]}>بطاقة</Text>
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

          {/* عرض الكلمات كاملة أسفل المشغّل مع أزرار النسخ ووضع القراءة */}
          {lyricsLines.length > 0 && (
            <View
              style={[styles.lyricsPreviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.lyricsPreviewHead}>
                <View style={styles.rowCenterGap}>
                  <Icon name="lyrics" size={16} color={theme.accent} />
                  <Text style={[styles.lyricsPreviewTitle, { color: theme.accent }]}>الكلمات</Text>
                </View>
                <View style={styles.rowCenterGap}>
                  <Pressable onPress={() => void handleCopyLyrics()} hitSlop={8}>
                    <Text style={[styles.lyricsPreviewCta, { color: theme.textSecondary }]}>نسخ</Text>
                  </Pressable>
                  <Text style={{ color: theme.textMuted }}>•</Text>
                  <Pressable onPress={() => setTab('lyrics')} hitSlop={8}>
                    <Text style={[styles.lyricsPreviewCta, { color: theme.accent }]}>وضع القراءة الكامل ←</Text>
                  </Pressable>
                </View>
              </View>
              <Text selectable style={[styles.lyricsPreviewLines, { color: theme.textPrimary }]}>
                {lyricsLines.join('\n')}
              </Text>
            </View>
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
            </View>
          </View>

          <ScrollView
            style={styles.flexScroll}
            contentContainerStyle={styles.lyricsContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={[styles.lyricsSongHeader, { color: theme.accent }]}>{track.title}</Text>
            {track.poet && (
              <Text style={[styles.lyricsPoetHeader, { color: theme.textSecondary }]}>
                {track.poet.startsWith('كلمات') ? track.poet : `كلمات: ${track.poet}`}
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

          {/* شريط تحكم مصغر أسفل الكلمات مع شريط تقدم */}
          <View style={[styles.lyricsFooterWrap, { backgroundColor: theme.surfaceGlass, borderTopColor: theme.border }]}>
            <View style={[styles.lyricsProgressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.lyricsProgressFill,
                  { width: `${progressRatio * 100}%`, backgroundColor: theme.accent },
                ]}
              />
            </View>
            <View style={styles.lyricsFooterPlay}>
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                {formatDuration(displayPos)} / {formatDuration(safeDuration)}
              </Text>
              <View style={styles.rowCenterGap}>
                <Pressable onPress={() => void playPrevious()} style={styles.smallCtrlBtn}>
                  <Icon name="prev" size={20} color={theme.textPrimary} />
                </Pressable>
                <Pressable
                  onPress={() => void togglePlayPause()}
                  style={[styles.miniPlayCircle, { backgroundColor: theme.accent }]}
                >
                  <Icon name={showPauseIcon ? 'pause' : 'play'} size={20} color={theme.accentText} />
                </Pressable>
                <Pressable onPress={() => void playNext()} style={styles.smallCtrlBtn}>
                  <Icon name="next" size={20} color={theme.textPrimary} />
                </Pressable>
              </View>
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
                  coverUrl={qTrack.coverUrl}
                  size={42}
                  borderRadius={10}
                  isCurrent={active}
                  isPlaying={active && isPlaying && !isBuffering}
                  isLoading={active && isBuffering}
                  title={qTrack.title}
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
    overflow: 'hidden',
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
  trackMetaLine: {
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  circleActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekSection: {
    gap: 6,
    paddingTop: 4,
  },
  seekBarWrap: {
    height: 30,
    justifyContent: 'center',
    position: 'relative',
  },
  seekTrackBg: {
    height: 5,
    width: '100%',
    borderRadius: 99,
    overflow: 'hidden',
    position: 'relative',
  },
  seekBufferedFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.35,
    borderRadius: 99,
  },
  seekActiveFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 99,
  },
  seekThumb: {
    position: 'absolute',
    top: 7,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    pointerEvents: 'none',
  },
  bufferingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lyricsFooterWrap: {
    borderTopWidth: 1,
  },
  lyricsProgressTrack: {
    height: 3,
    width: '100%',
  },
  lyricsProgressFill: {
    height: '100%',
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
    paddingBottom: 64,
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

