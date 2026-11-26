import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { DARK_THEME, LIGHT_THEME } from './theme/tokens';
import { useAppStore } from './store/useAppStore';
import { WebDeviceFrame } from './components/WebDeviceFrame';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { FullPlayerModal } from './components/FullPlayerModal';
import { LyricsCardModal } from './components/LyricsCardModal';
import { PlaylistPickerModal } from './components/PlaylistPickerModal';
import { ToastBanner } from './components/ToastBanner';
import { SplashScreen } from './components/SplashScreen';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export const App: React.FC = () => {
  // اشتراك انتقائي (Selector) حتى لا تعيد الشاشة الرئيسية الرسم عند كل تحديث لوقت الصوت!
  const {
    theme: themeMode,
    activeTab,
    setActiveTab,
    toggleTheme,
    connectionMode,
    tracks,
    isSyncing,
    currentTrackId,
    isPlaying,
    isBuffering,
    favorites,
    toast,
    isPlayerOpen,
    lyricsShareTrackId,
    playlistPickerTrackId,
    openPlayer,
    togglePlayPause,
    playNext,
    toggleFavorite,
    apiBaseUrl,
    syncWithTelegramApi,
    showToast,
  } = useAppStore(
    useShallow((s) => ({
      theme: s.theme,
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      toggleTheme: s.toggleTheme,
      connectionMode: s.connectionMode,
      tracks: s.tracks,
      isSyncing: s.isSyncing,
      currentTrackId: s.currentTrackId,
      isPlaying: s.isPlaying,
      isBuffering: s.isBuffering,
      favorites: s.favorites,
      toast: s.toast,
      isPlayerOpen: s.isPlayerOpen,
      lyricsShareTrackId: s.lyricsShareTrackId,
      playlistPickerTrackId: s.playlistPickerTrackId,
      openPlayer: s.openPlayer,
      togglePlayPause: s.togglePlayPause,
      playNext: s.playNext,
      toggleFavorite: s.toggleFavorite,
      apiBaseUrl: s.apiBaseUrl,
      syncWithTelegramApi: s.syncWithTelegramApi,
      showToast: s.showToast,
    }))
  );

  const [showSplash, setShowSplash] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);

  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  const handleConfirmExit = useCallback(() => {
    setShowExitModal(false);
    const bridge = (window as unknown as { AndroidBridge?: { exitApp?: () => void } }).AndroidBridge;
    if (bridge?.exitApp) {
      bridge.exitApp();
      return;
    }
    window.history.go(-2);
  }, []);

  // مزامنة تلقائية فور فتح التطبيق (بصمت إذا كانت المكتبة مخبأة محلياً)
  useEffect(() => {
    const hasCached = tracks.length > 0;
    void syncWithTelegramApi(apiBaseUrl, hasCached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // أوامر إشعار النظام (السابق / تشغيل-إيقاف / التالي) القادمة من أندرويد
  useEffect(() => {
    (window as unknown as { __nativeMediaAction?: (a: string) => void }).__nativeMediaAction = (
      action: string
    ) => {
      const s = useAppStore.getState();
      if (action === 'next') void s.playNext();
      else if (action === 'prev') void s.playPrevious();
      else if (action === 'play') {
        if (!s.isPlaying) void s.togglePlayPause();
      } else if (action === 'pause') {
        if (s.isPlaying || s.isBuffering) void s.togglePlayPause();
      } else void s.togglePlayPause();
    };
  }, []);

  // إدارة زر الرجوع (أندرويد والمتصفح) للعودة للرئيسية ثم إظهار نافذة تأكيد الخروج
  useEffect(() => {
    if (typeof window === 'undefined') return;

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
      if (handleBackAction()) {
        window.history.pushState({ appGuard: true }, '');
        return;
      }
      setShowExitModal((prev) => !prev);
      window.history.pushState({ appGuard: true }, '');
    };

    window.addEventListener('popstate', onPopState);
    (window as unknown as { handleAppBack?: () => boolean }).handleAppBack = () => {
      if (handleBackAction()) return true;
      setShowExitModal((prev) => !prev);
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
        <ExitConfirmModal
          visible={showExitModal}
          theme={theme}
          onStay={() => setShowExitModal(false)}
          onConfirmExit={handleConfirmExit}
        />
        <ToastBanner toast={toast} theme={theme} />
        {showSplash && (
          <SplashScreen
            isReady={tracks.length > 0 || !isSyncing}
            onFinish={handleSplashFinish}
          />
        )}
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

