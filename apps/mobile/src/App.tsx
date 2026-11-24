import React, { useEffect, useMemo } from 'react';
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
    positionSec,
    durationSec,
    favorites,
    toast,
    openPlayer,
    togglePlayPause,
    playNext,
    toggleFavorite,
    apiBaseUrl,
    syncWithTelegramApi,
  } = useAppStore();

  // مزامنة تلقائية فور فتح التطبيق عند وجود رابط Cloudflare Edge API
  useEffect(() => {
    if (apiBaseUrl) {
      void syncWithTelegramApi(apiBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            positionSec={positionSec}
            durationSec={durationSec || currentTrack.durationSec}
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

