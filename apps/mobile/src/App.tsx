import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { DARK_THEME, LIGHT_THEME } from './theme/tokens';
import { useAppStore } from './store/useAppStore';
import { WebDeviceFrame } from './components/WebDeviceFrame';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { FullPlayerModal } from './components/FullPlayerModal';
import { LyricsCardModal } from './components/LyricsCardModal';
import { PlaylistPickerModal } from './components/PlaylistPickerModal';
import { ToastBanner } from './components/ToastBanner';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export const App: React.FC = () => {
  const {
    theme: themeMode,
    activeTab,
    setActiveTab,
    toggleTheme,
    connectionMode,
    tracks,
    currentTrackId,
    isPlaying,
    isBuffering,
    positionSec,
    durationSec,
    bufferedSec,
    favorites,
    toast,
    isPlayerOpen,
    lyricsShareTrackId,
    playlistPickerTrackId,
    openPlayer,
    closePlayer,
    closeLyricsShare,
    closePlaylistPicker,
    togglePlayPause,
    playNext,
    toggleFavorite,
    apiBaseUrl,
    syncWithTelegramApi,
    showToast,
  } = useAppStore();

  const lastBackPressRef = useRef<number>(0);

  // مزامنة تلقائية فور فتح التطبيق (بصمت إذا كانت المكتبة مخبأة محلياً)
  useEffect(() => {
    const hasCached = tracks.length > 0;
    void syncWithTelegramApi(apiBaseUrl, hasCached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // إدارة زر الرجوع (أندرويد والمتصفح) للعودة للرئيسية بدلاً من الخروج المباشر
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // إضافة حالة حارس في سجل المتصفح عند البداية
    window.history.replaceState({ appRoot: true }, '');
    window.history.pushState({ appGuard: true }, '');

    const handleBackAction = (): boolean => {
      const s = useAppStore.getState();
      if (s.lyricsShareTrackId) {
        s.closeLyricsShare();
        return true;
      }
      if (s.playlistPickerTrackId) {
        s.closePlaylistPicker();
        return true;
      }
      if (s.isPlayerOpen) {
        s.closePlayer();
        return true;
      }
      if (s.activeTab !== 'home') {
        s.setActiveTab('home');
        return true;
      }
      return false;
    };

    const onPopState = () => {
      const handled = handleBackAction();
      if (handled) {
        window.history.pushState({ appGuard: true }, '');
        return;
      }
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        // السماح بالخروج عند الضغط مرتين متتاليتين في الرئيسية
        return;
      }
      lastBackPressRef.current = now;
      showToast('اضغط رجوع مرة أخرى للخروج من التطبيق', 'info');
      window.history.pushState({ appGuard: true }, '');
    };

    window.addEventListener('popstate', onPopState);
    // دعم مباشر لـ Android WebView إذا استدعى handleAppBack()
    (window as unknown as { handleAppBack?: () => boolean }).handleAppBack = () => {
      const handled = handleBackAction();
      if (handled) return true;
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) return false;
      lastBackPressRef.current = now;
      showToast('اضغط رجوع مرة أخرى للخروج من التطبيق', 'info');
      return true;
    };

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [showToast]);

  // إبقاء حالة الحارس متزامنة عند فتح أي نافذة أو تبديل تبويب
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isPlayerOpen || lyricsShareTrackId || playlistPickerTrackId || activeTab !== 'home') {
      if (!window.history.state?.appGuard) {
        window.history.pushState({ appGuard: true }, '');
      }
    }
  }, [isPlayerOpen, lyricsShareTrackId, playlistPickerTrackId, activeTab]);

  const theme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) ?? null,
    [tracks, currentTrackId]
  );

  return (
    <WebDeviceFrame
      theme={theme}
      connectionMode={connectionMode}
      onToggleTheme={toggleTheme}
    >
      <View style={[styles.appRoot, { backgroundColor: theme.bg }]}>
        {/* المحتوى النشط للتبويب */}
        <View style={styles.screenArea}>
          {activeTab === 'home' && <HomeScreen theme={theme} />}
          {activeTab === 'search' && <SearchScreen theme={theme} />}
          {activeTab === 'library' && <LibraryScreen theme={theme} />}
          {activeTab === 'settings' && <SettingsScreen theme={theme} />}
        </View>

        {/* المشغّل المصغّر العائم */}
        {currentTrack && (
          <MiniPlayer
            track={currentTrack}
            theme={theme}
            isPlaying={isPlaying}
            isBuffering={isBuffering}
            positionSec={positionSec}
            durationSec={durationSec || currentTrack.durationSec}
            bufferedSec={bufferedSec}
            isFavorite={favorites.includes(currentTrack.id)}
            onOpenFull={() => openPlayer('player')}
            onOpenLyrics={() => openPlayer('lyrics')}
            onTogglePlay={() => void togglePlayPause()}
            onNext={() => void playNext()}
            onToggleFavorite={() => toggleFavorite(currentTrack.id)}
          />
        )}

        {/* شريط التنقل السفلي (Material Design 3) */}
        <BottomNav activeTab={activeTab} theme={theme} onChange={setActiveTab} />

        {/* النوافذ الغامرة فوق الشاشة */}
        <FullPlayerModal theme={theme} />
        <LyricsCardModal theme={theme} />
        <PlaylistPickerModal theme={theme} />
        <ToastBanner toast={toast} theme={theme} />
      </View>
    </WebDeviceFrame>
  );
};

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    position: 'relative',
  },
  screenArea: {
    flex: 1,
    minHeight: 0,
  },
});

export default App;

