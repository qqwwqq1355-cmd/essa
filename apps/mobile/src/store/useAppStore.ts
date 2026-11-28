import { create } from 'zustand';
import type { Track, TrackCategory } from '@shared/types/track';
import { normalizeArabic } from '@shared/arabic/normalize';
import { getDeterministicPalette } from '@shared/arabic/lyricsParser';
import type { ThemeMode } from '../theme/tokens';
import { audioEngine } from '../services/audio/AudioEngine';
import {
  abortBackgroundCaching,
  clearAllCachedAudio,
  removeCachedAudio,
  saveAudioToDevice,
} from '../services/audio/audioCache';
import { pauseImageLoading } from '../services/images/imageLoader';
import { fetchDeltaSync, getDefaultApiBaseUrl } from '../services/api/syncClient';
import {
  requestRewardedAdForDownload,
  triggerInterstitialOnTrackPlay,
} from '../services/ads/startIoAds';

export type ActiveTab = 'home' | 'search' | 'offline' | 'library' | 'settings';
export type RepeatMode = 'off' | 'all' | 'one';

export interface UserPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
}

export interface PersistedState {
  theme: ThemeMode;
  lyricsFontSize: number;
  keepScreenAwake: boolean;
  notificationsEnabled: boolean;
  cacheLimitMb: number;
  apiBaseUrl: string;
  favorites: string[];
  downloadedIds: string[];
  playlists: UserPlaylist[];
  playProgress: Record<string, number>;
  playHistory: string[];
  recentSearches: string[];
  lastSyncAt: string | null;
}

const STORAGE_KEY = 'essa_alleth_app_state_v2';
const TRACKS_CACHE_KEY = 'essa_alleth_tracks_cache_v2';

const DEFAULT_PERSISTED: PersistedState = {
  theme: 'dark',
  lyricsFontSize: 21,
  keepScreenAwake: true,
  notificationsEnabled: true,
  cacheLimitMb: 500,
  apiBaseUrl: getDefaultApiBaseUrl(),
  favorites: [],
  downloadedIds: [],
  playlists: [],
  playProgress: {},
  playHistory: [],
  recentSearches: [],
  lastSyncAt: null,
};

function isNotPreviewId(id: string): boolean {
  return !id.startsWith('preview_');
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERSISTED;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const merged: PersistedState = { ...DEFAULT_PERSISTED, ...parsed };
    if (
      !merged.apiBaseUrl ||
      merged.apiBaseUrl.includes('workers.dev') ||
      merged.apiBaseUrl.includes('pages.dev')
    ) {
      merged.apiBaseUrl = getDefaultApiBaseUrl();
    }
    // تنظيف أي معرفات تجريبية قديمة إن وُجدت
    merged.favorites = (merged.favorites || []).filter(isNotPreviewId);
    merged.downloadedIds = (merged.downloadedIds || []).filter(isNotPreviewId);
    merged.playHistory = (merged.playHistory || []).filter(isNotPreviewId);
    merged.playlists = (merged.playlists || []).map((p) => ({
      ...p,
      trackIds: (p.trackIds || []).filter(isNotPreviewId),
    }));
    return merged;
  } catch {
    return DEFAULT_PERSISTED;
  }
}

function savePersisted(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // تجاهل
  }
}

const bundledCoversMap = new Map<string, string>();
const bundledLyricsMap = new Map<string, { lyrics: string; poet: string | null }>();
let bundledCatalogPromise: Promise<Track[]> | null = null;

function normalizeOfflineCoverUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/offline/') ? `.${url}` : url;
}

async function loadBundledCatalogOnce(): Promise<Track[]> {
  if (bundledCatalogPromise) return bundledCatalogPromise;
  bundledCatalogPromise = (async () => {
    try {
      const localRes = await fetch('./offline/catalog.json');
      if (!localRes.ok) return [];
      const localData = (await localRes.json()) as { tracks?: Track[] };
      if (!Array.isArray(localData.tracks) || localData.tracks.length === 0) return [];
      const hydrated = localData.tracks.map((t) => {
        const coverUrl = normalizeOfflineCoverUrl(t.coverUrl);
        if (coverUrl && (coverUrl.startsWith('./offline/') || coverUrl.startsWith('offline/'))) {
          bundledCoversMap.set(t.id, coverUrl);
        }
        const cleanLyr = t.lyrics && t.lyrics.trim().length > 0 ? t.lyrics : null;
        if (cleanLyr) {
          bundledLyricsMap.set(t.id, { lyrics: cleanLyr, poet: t.poet ?? null });
        }
        return {
          ...t,
          coverUrl,
          lyrics: cleanLyr,
          hasLyrics: Boolean(cleanLyr),
          titleNormalized: t.titleNormalized || normalizeArabic(t.title),
          lyricsNormalized: t.lyricsNormalized || normalizeArabic(cleanLyr),
        };
      });
      return hydrated;
    } catch {
      return [];
    }
  })();
  return bundledCatalogPromise;
}

function loadCachedTracks(): Track[] {
  try {
    const raw = localStorage.getItem(TRACKS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Track[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && !t.isDemoPreview && isNotPreviewId(t.id))
      .map((t) => ({
        ...t,
        coverUrl: normalizeOfflineCoverUrl(t.coverUrl),
      }));
  } catch {
    return [];
  }
}

function saveCachedTracks(tracks: Track[]) {
  try {
    const realOnly = tracks.filter(
      (t) => !t.isDemoPreview && t.storageProvider !== 'local' && isNotPreviewId(t.id)
    );
    localStorage.setItem(TRACKS_CACHE_KEY, JSON.stringify(realOnly));
  } catch {
    // تجاهل في حال تجاوز سعة localStorage
  }
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface AppState extends PersistedState {
  activeTab: ActiveTab;
  selectedCategory: TrackCategory | 'الكل';

  tracks: Track[];
  isSyncing: boolean;
  connectionMode: 'live' | 'offline';
  syncError: string | null;

  currentTrackId: string | null;
  queueIds: string[];
  isPlaying: boolean;
  isBuffering: boolean;
  positionSec: number;
  durationSec: number;
  bufferedSec: number;
  playbackRate: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  sleepTimerEndsAt: number | null;

  isPlayerOpen: boolean;
  playerInitialTab: 'player' | 'lyrics' | 'queue';
  lyricsShareTrackId: string | null;
  playlistPickerTrackId: string | null;
  downloadingIds: Record<string, number>;
  playbackError: { trackId: string; message: string } | null;
  toast: ToastMessage | null;

  setActiveTab: (tab: ActiveTab) => void;
  setSelectedCategory: (cat: TrackCategory | 'الكل') => void;
  toggleTheme: () => void;
  setLyricsFontSize: (size: number) => void;
  toggleKeepScreenAwake: () => void;
  toggleNotifications: () => void;
  setCacheLimitMb: (mb: number) => void;
  setApiBaseUrl: (url: string) => void;

  playTrack: (trackId: string, queueOverride?: string[], openTab?: 'player' | 'lyrics') => Promise<void>;
  togglePlayPause: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  seekTo: (seconds: number) => void;
  skipBy: (deltaSec: number) => void;
  cyclePlaybackRate: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setSleepTimerMinutes: (minutes: number | null) => void;
  openPlayer: (tab?: 'player' | 'lyrics' | 'queue') => void;
  closePlayer: () => void;

  toggleFavorite: (trackId: string) => void;
  downloadTrack: (trackId: string) => void;
  removeDownload: (trackId: string) => void;
  clearAllDownloads: () => void;
  createPlaylist: (name: string, initialTrackId?: string) => void;
  deletePlaylist: (playlistId: string) => void;
  toggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  clearPlayHistory: () => void;
  clearPlaybackError: () => void;
  retryCurrentTrack: () => Promise<void>;

  openLyricsShare: (trackId: string) => void;
  closeLyricsShare: () => void;
  openPlaylistPicker: (trackId: string) => void;
  closePlaylistPicker: () => void;

  syncWithTelegramApi: (customBaseUrl?: string, silent?: boolean) => Promise<void>;
  importLocalAudioFile: (file: File, customLyrics?: string) => void;
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
}

const initialPersisted = loadPersisted();
const initialTracks = loadCachedTracks();

function persistFromState(s: AppState) {
  savePersisted({
    theme: s.theme,
    lyricsFontSize: s.lyricsFontSize,
    keepScreenAwake: s.keepScreenAwake,
    notificationsEnabled: s.notificationsEnabled,
    cacheLimitMb: s.cacheLimitMb,
    apiBaseUrl: s.apiBaseUrl,
    favorites: s.favorites,
    downloadedIds: s.downloadedIds,
    playlists: s.playlists,
    playProgress: s.playProgress,
    playHistory: s.playHistory,
    recentSearches: s.recentSearches,
    lastSyncAt: s.lastSyncAt,
  });
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let sleepCheckTimer: ReturnType<typeof setInterval> | null = null;

export const useAppStore = create<AppState>((set, get) => {
  audioEngine.bindCallbacks({
    onTimeUpdate: (pos, dur, buffered) => {
      const state = get();
      const trackId = state.currentTrackId;
      const updates: Partial<AppState> = {
        positionSec: pos,
        durationSec: dur > 0 ? dur : state.durationSec,
        bufferedSec: buffered,
      };
      if (trackId && Math.floor(pos) % 5 === 0 && pos > 2) {
        updates.playProgress = { ...state.playProgress, [trackId]: Math.floor(pos) };
      }
      set(updates);
    },
    onPlayStateChange: (isPlaying, isBuffering) => {
      set({ isPlaying, isBuffering });
    },
    onEnded: () => {
      const state = get();
      if (state.repeatMode === 'one' && state.currentTrackId) {
        audioEngine.seekTo(0);
        void audioEngine.play();
        return;
      }
      void state.playNext();
    },
    onError: (msg) => {
      const state = get();
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const friendlyMsg = isOffline
        ? 'لا يوجد اتصال بالإنترنت — هذا الزامل غير محمّل محلياً'
        : msg || 'تعذّر تشغيل الزامل حالياً — تحقق من الاتصال وأعد المحاولة';
      set({
        isPlaying: false,
        isBuffering: false,
        playbackError: state.currentTrackId
          ? { trackId: state.currentTrackId, message: friendlyMsg }
          : null,
      });
      state.showToast(friendlyMsg, 'error');
    },
    onRemoteNext: () => {
      void get().playNext();
    },
    onRemotePrevious: () => {
      void get().playPrevious();
    },
    onTrackCached: (trackId) => {
      set((s) => {
        if (s.downloadedIds.includes(trackId)) return s;
        const downloadedIds = [trackId, ...s.downloadedIds];
        persistFromState({ ...s, downloadedIds });
        return { downloadedIds };
      });
    },
  });

  if (typeof window !== 'undefined' && !sleepCheckTimer) {
    sleepCheckTimer = setInterval(() => {
      const state = get();
      if (state.sleepTimerEndsAt && Date.now() >= state.sleepTimerEndsAt) {
        audioEngine.pause();
        set({ sleepTimerEndsAt: null, isPlaying: false });
        state.showToast('انتهى مؤقت النوم — تم إيقاف التشغيل تلقائياً', 'info');
      }
    }, 1000);
  }

  return {
    ...initialPersisted,
    activeTab: 'home',
    selectedCategory: 'الكل',
    tracks: initialTracks,
    isSyncing: initialTracks.length === 0,
    connectionMode: 'live',
    syncError: null,

    currentTrackId: initialTracks[0]?.id ?? null,
    queueIds: initialTracks.map((t) => t.id),
    isPlaying: false,
    isBuffering: false,
    positionSec: 0,
    durationSec: initialTracks[0]?.durationSec ?? 0,
    bufferedSec: 0,
    playbackRate: 1,
    shuffle: false,
    repeatMode: 'all',
    sleepTimerEndsAt: null,

    isPlayerOpen: false,
    playerInitialTab: 'player',
    lyricsShareTrackId: null,
    playlistPickerTrackId: null,
    downloadingIds: {},
    playbackError: null,
    toast: null,

    setActiveTab: (activeTab) => set({ activeTab }),
    setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

    toggleTheme: () => {
      set((s) => {
        const next: ThemeMode = s.theme === 'dark' ? 'light' : 'dark';
        persistFromState({ ...s, theme: next });
        return { theme: next };
      });
    },

    setLyricsFontSize: (lyricsFontSize) => {
      const clamped = Math.min(30, Math.max(15, lyricsFontSize));
      set((s) => {
        persistFromState({ ...s, lyricsFontSize: clamped });
        return { lyricsFontSize: clamped };
      });
    },

    toggleKeepScreenAwake: () => {
      set((s) => {
        const next = !s.keepScreenAwake;
        persistFromState({ ...s, keepScreenAwake: next });
        return { keepScreenAwake: next };
      });
    },

    toggleNotifications: () => {
      set((s) => {
        const next = !s.notificationsEnabled;
        persistFromState({ ...s, notificationsEnabled: next });
        return { notificationsEnabled: next };
      });
    },

    setCacheLimitMb: (cacheLimitMb) => {
      set((s) => {
        persistFromState({ ...s, cacheLimitMb });
        return { cacheLimitMb };
      });
    },

    setApiBaseUrl: (apiBaseUrl) => {
      const cleaned = apiBaseUrl.trim().replace(/\/+$/, '') || getDefaultApiBaseUrl();
      set((s) => {
        persistFromState({ ...s, apiBaseUrl: cleaned });
        return { apiBaseUrl: cleaned };
      });
    },

    playTrack: async (trackId, queueOverride, openTab) => {
      // إيقاف فوري لكل طلبات الصور والتنزيلات الخلفية قبل أي تحديث للحالة!
      abortBackgroundCaching();
      pauseImageLoading(6000);

      const state = get();
      const track = state.tracks.find((t) => t.id === trackId);
      if (!track) return;

      const queueIds = queueOverride && queueOverride.length > 0 ? queueOverride : state.queueIds;
      const ensuredQueue = queueIds.includes(trackId) ? queueIds : [trackId, ...queueIds];
      const savedPos = state.playProgress[trackId] ?? 0;
      const resumePos = savedPos > 3 && savedPos < track.durationSec - 4 ? savedPos : 0;
      const playHistory = [trackId, ...state.playHistory.filter((id) => id !== trackId)].slice(0, 50);

      set({
        currentTrackId: trackId,
        queueIds: ensuredQueue,
        playHistory,
        playbackError: null,
        isPlaying: true,
        isBuffering: true,
        positionSec: resumePos,
        durationSec: track.durationSec,
        bufferedSec: 0,
        isPlayerOpen: openTab ? true : state.isPlayerOpen,
        playerInitialTab: openTab ?? state.playerInitialTab,
      });
      persistFromState({ ...get(), playHistory });

      await audioEngine.loadAndPlay(
        track,
        resumePos,
        state.playbackRate,
        state.downloadedIds.includes(trackId)
      );

      // إعلان بيني ذكي من Start.io كل 3 زوامل (مع فاصل زمني لا يقل عن دقيقتين)
      triggerInterstitialOnTrackPlay();
    },

    togglePlayPause: async () => {
      const state = get();
      if (!state.currentTrackId) {
        if (state.tracks[0]) {
          await state.playTrack(state.tracks[0].id);
        }
        return;
      }

      // إذا كان المقطع يعمل أو في حالة تحميل، أوقفه فوراً دون انتظار اكتمال التحميل
      if (state.isPlaying || state.isBuffering) {
        audioEngine.pause();
        set({ isPlaying: false, isBuffering: false });
        return;
      }

      if (audioEngine.getCurrentTrackId() !== state.currentTrackId) {
        await state.playTrack(state.currentTrackId);
        return;
      }

      await audioEngine.play();
    },

    playNext: async () => {
      const state = get();
      if (state.queueIds.length === 0) return;

      const idx = state.currentTrackId ? state.queueIds.indexOf(state.currentTrackId) : -1;
      let nextIdx: number;

      if (state.shuffle && state.queueIds.length > 1) {
        do {
          nextIdx = Math.floor(Math.random() * state.queueIds.length);
        } while (nextIdx === idx);
      } else if (idx + 1 < state.queueIds.length) {
        nextIdx = idx + 1;
      } else if (state.repeatMode === 'all') {
        nextIdx = 0;
      } else {
        audioEngine.pause();
        return;
      }

      const nextId = state.queueIds[nextIdx];
      if (nextId) {
        await state.playTrack(nextId);
      }
    },

    playPrevious: async () => {
      const state = get();
      if (state.positionSec > 4) {
        audioEngine.seekTo(0);
        set({ positionSec: 0 });
        return;
      }
      if (state.queueIds.length === 0) return;
      const idx = state.currentTrackId ? state.queueIds.indexOf(state.currentTrackId) : 0;
      const prevIdx = idx > 0 ? idx - 1 : state.queueIds.length - 1;
      const prevId = state.queueIds[prevIdx];
      if (prevId) {
        await state.playTrack(prevId);
      }
    },

    seekTo: (seconds) => {
      audioEngine.seekTo(seconds);
      set({ positionSec: Math.max(0, seconds) });
    },

    skipBy: (deltaSec) => {
      const state = get();
      const target = Math.max(0, Math.min(state.durationSec || 0, state.positionSec + deltaSec));
      audioEngine.seekTo(target);
      set({ positionSec: target });
    },

    cyclePlaybackRate: () => {
      const rates = [0.75, 1, 1.25, 1.5];
      const current = get().playbackRate;
      const next = rates[(rates.indexOf(current) + 1) % rates.length];
      audioEngine.setPlaybackRate(next);
      set({ playbackRate: next });
      get().showToast(`سرعة التشغيل: ${next}x`, 'info');
    },

    toggleShuffle: () => {
      set((s) => ({ shuffle: !s.shuffle }));
      get().showToast(get().shuffle ? 'تم تفعيل التشغيل العشوائي' : 'تم إيقاف التشغيل العشوائي', 'info');
    },

    cycleRepeatMode: () => {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      const next = order[(order.indexOf(get().repeatMode) + 1) % order.length];
      set({ repeatMode: next });
      const labels: Record<RepeatMode, string> = {
        off: 'التكرار: إيقاف',
        all: 'التكرار: القائمة كاملة',
        one: 'التكرار: المقطع الحالي',
      };
      get().showToast(labels[next], 'info');
    },

    setSleepTimerMinutes: (minutes) => {
      if (!minutes) {
        set({ sleepTimerEndsAt: null });
        get().showToast('تم إلغاء مؤقت النوم', 'info');
        return;
      }
      set({ sleepTimerEndsAt: Date.now() + minutes * 60_000 });
      get().showToast(`سيتوقف التشغيل تلقائياً بعد ${minutes} دقيقة`, 'success');
    },

    openPlayer: (tab = 'player') => set({ isPlayerOpen: true, playerInitialTab: tab }),
    closePlayer: () => set({ isPlayerOpen: false }),

    toggleFavorite: (trackId) => {
      set((s) => {
        const exists = s.favorites.includes(trackId);
        const favorites = exists
          ? s.favorites.filter((id) => id !== trackId)
          : [trackId, ...s.favorites];
        persistFromState({ ...s, favorites });
        return { favorites };
      });
    },

    downloadTrack: (trackId) => {
      const state = get();
      if (state.downloadingIds[trackId] !== undefined) {
        return;
      }
      const track = state.tracks.find((t) => t.id === trackId);
      if (!track?.streamUrl) {
        get().showToast('رابط التحميل غير متوفر لهذا المقطع حالياً', 'error');
        return;
      }

      set((s) => ({ downloadingIds: { ...s.downloadingIds, [trackId]: 40 } }));

      void requestRewardedAdForDownload().then(() =>
        saveAudioToDevice(track.streamUrl!, track.title).then((ok) => {
        set((s) => {
          const nextDownloading = { ...s.downloadingIds };
          delete nextDownloading[trackId];
          const downloadedIds = s.downloadedIds.includes(trackId)
            ? s.downloadedIds
            : [trackId, ...s.downloadedIds];
          persistFromState({ ...s, downloadedIds });
          return { downloadingIds: nextDownloading, downloadedIds };
        });

        if (ok) {
          get().showToast('تم حفظ الزامل كملف MP3 في ذاكرة الجهاز (التنزيلات)', 'success');
        } else {
          get().showToast('تعذّر حفظ الملف في الجهاز حالياً', 'error');
        }
        })
      );
    },

    removeDownload: (trackId) => {
      const track = get().tracks.find((t) => t.id === trackId);
      void removeCachedAudio(track?.streamUrl);
      set((s) => {
        const downloadedIds = s.downloadedIds.filter((id) => id !== trackId);
        persistFromState({ ...s, downloadedIds });
        return { downloadedIds };
      });
      get().showToast('تم حذف المقطع من التحميلات المحلية', 'info');
    },

    clearAllDownloads: () => {
      void clearAllCachedAudio();
      set((s) => {
        persistFromState({ ...s, downloadedIds: [] });
        return { downloadedIds: [] };
      });
      get().showToast('تم تفريغ جميع الملفات المحفوظة أوفلاين', 'info');
    },

    clearPlayHistory: () => {
      set((s) => {
        persistFromState({ ...s, playHistory: [] });
        return { playHistory: [] };
      });
      get().showToast('تم مسح سجل الاستماع', 'info');
    },

    clearPlaybackError: () => set({ playbackError: null }),

    retryCurrentTrack: async () => {
      const state = get();
      const targetId = state.playbackError?.trackId || state.currentTrackId;
      if (!targetId) return;
      set({ playbackError: null });
      await state.playTrack(targetId);
    },

    createPlaylist: (name, initialTrackId) => {
      const clean = name.trim();
      if (!clean) return;
      const newPl: UserPlaylist = {
        id: `pl_${Date.now()}`,
        name: clean,
        trackIds: initialTrackId ? [initialTrackId] : [],
        createdAt: new Date().toISOString(),
      };
      set((s) => {
        const playlists = [newPl, ...s.playlists];
        persistFromState({ ...s, playlists });
        return { playlists };
      });
      get().showToast(`تم إنشاء قائمة "${clean}"`, 'success');
    },

    deletePlaylist: (playlistId) => {
      set((s) => {
        const playlists = s.playlists.filter((p) => p.id !== playlistId);
        persistFromState({ ...s, playlists });
        return { playlists };
      });
      get().showToast('تم حذف قائمة التشغيل', 'info');
    },

    toggleTrackInPlaylist: (playlistId, trackId) => {
      let added = false;
      set((s) => {
        const playlists = s.playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const exists = p.trackIds.includes(trackId);
          added = !exists;
          return {
            ...p,
            trackIds: exists
              ? p.trackIds.filter((id) => id !== trackId)
              : [...p.trackIds, trackId],
          };
        });
        persistFromState({ ...s, playlists });
        return { playlists };
      });
      get().showToast(added ? 'تمت الإضافة إلى قائمة التشغيل' : 'تمت الإزالة من قائمة التشغيل', 'info');
    },

    addRecentSearch: (query) => {
      const clean = query.trim();
      if (clean.length < 2) return;
      set((s) => {
        const recentSearches = [clean, ...s.recentSearches.filter((q) => q !== clean)].slice(0, 8);
        persistFromState({ ...s, recentSearches });
        return { recentSearches };
      });
    },

    clearRecentSearches: () => {
      set((s) => {
        persistFromState({ ...s, recentSearches: [] });
        return { recentSearches: [] };
      });
    },

    openLyricsShare: (trackId) => set({ lyricsShareTrackId: trackId }),
    closeLyricsShare: () => set({ lyricsShareTrackId: null }),
    openPlaylistPicker: (trackId) => set({ playlistPickerTrackId: trackId }),
    closePlaylistPicker: () => set({ playlistPickerTrackId: null }),

    syncWithTelegramApi: async (customBaseUrl, silent = false) => {
      const state = get();
      const targetUrl = ((customBaseUrl ?? state.apiBaseUrl) || getDefaultApiBaseUrl())
        .trim()
        .replace(/\/+$/, '');

      set({ isSyncing: true, syncError: null });

      try {
        // 1) تهيئة الفهرس والصور المدمجة داخل التطبيق دائماً في 0ms (حتى لو كان الكاش ممتلئاً سابقاً)
        const bundledTracks = await loadBundledCatalogOnce();
        if (bundledTracks.length > 0) {
          const currentTracks = get().tracks;
          if (currentTracks.length === 0) {
            set((s) => ({
              tracks: bundledTracks,
              currentTrackId: s.currentTrackId ?? bundledTracks[0]?.id ?? null,
              queueIds: bundledTracks.map((t) => t.id),
              isSyncing: false,
            }));
          } else if (bundledCoversMap.size > 0 || bundledLyricsMap.size > 0) {
            set((s) => ({
              tracks: s.tracks.map((t) => {
                const localCover = bundledCoversMap.get(t.id);
                const bundledLyr = bundledLyricsMap.get(t.id);
                const shouldUpgradeLyrics =
                  bundledLyr && (!t.lyrics || bundledLyr.lyrics.length > t.lyrics.length);
                return {
                  ...t,
                  coverUrl: localCover || t.coverUrl,
                  poet: t.poet || bundledLyr?.poet || null,
                  lyrics: shouldUpgradeLyrics ? bundledLyr.lyrics : t.lyrics,
                  hasLyrics: shouldUpgradeLyrics ? true : t.hasLyrics,
                  lyricsNormalized: shouldUpgradeLyrics
                    ? normalizeArabic(bundledLyr.lyrics)
                    : t.lyricsNormalized,
                };
              }),
            }));
          }
        }

        // 2) مزامنة تفاضلية حقيقية (sinceIso) تجلب فقط الجديد أو المحدّث بدلاً من سحب كل المكتبة في كل مرة!
        const existingReal = get().tracks.filter((t) => t.storageProvider !== 'local');
        let sinceIso: string | undefined;
        if (existingReal.length > 0) {
          let maxUpdated = '';
          for (const t of existingReal) {
            if (t.updatedAt && t.updatedAt > maxUpdated) {
              maxUpdated = t.updatedAt;
            }
          }
          if (maxUpdated) sinceIso = maxUpdated;
        }

        const response = await fetchDeltaSync(targetUrl, sinceIso);
        const mergedMap = new Map<string, Track>(existingReal.map((t) => [t.id, t]));
        for (const t of response.tracks) {
          if (t.isDeleted) {
            mergedMap.delete(t.id);
          } else {
            const bundledCover = bundledCoversMap.get(t.id);
            const bundledLyr = bundledLyricsMap.get(t.id);
            const prev = mergedMap.get(t.id);
            const bestLyrics =
              t.lyrics && (!bundledLyr || t.lyrics.length >= bundledLyr.lyrics.length)
                ? t.lyrics
                : bundledLyr?.lyrics || prev?.lyrics || null;
            const bestPoet = t.poet || bundledLyr?.poet || prev?.poet || null;
            mergedMap.set(t.id, {
              ...t,
              coverUrl: bundledCover || normalizeOfflineCoverUrl(t.coverUrl) || prev?.coverUrl || null,
              poet: bestPoet,
              lyrics: bestLyrics,
              hasLyrics: Boolean(bestLyrics && bestLyrics.trim().length > 0),
              lyricsNormalized: normalizeArabic(bestLyrics),
            });
          }
        }

        const liveTracks = Array.from(mergedMap.values()).sort((a, b) => {
          const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
          if (timeDiff !== 0) return timeDiff;
          return (b.sourceMessageId || 0) - (a.sourceMessageId || 0);
        });
        const localImported = get().tracks.filter((t) => t.storageProvider === 'local');
        const combined = [...localImported, ...liveTracks];
        const now = response.serverTime || new Date().toISOString();

        saveCachedTracks(liveTracks);

        set((s) => {
          const validCurrent =
            s.currentTrackId && combined.some((t) => t.id === s.currentTrackId)
              ? s.currentTrackId
              : combined[0]?.id ?? null;

          persistFromState({ ...s, apiBaseUrl: targetUrl, lastSyncAt: now });
          return {
            tracks: combined,
            currentTrackId: validCurrent,
            queueIds: combined.map((t) => t.id),
            apiBaseUrl: targetUrl,
            lastSyncAt: now,
            connectionMode: 'live',
            isSyncing: false,
            syncError: null,
          };
        });

        if (!silent) {
          get().showToast(`تم تحديث المكتبة (${liveTracks.length} زامل)`, 'success');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذّر الاتصال بالخادم — تعمل المكتبة بالوضع المحلي';
        const hasTracks = get().tracks.length > 0;
        set({ isSyncing: false, syncError: hasTracks ? null : msg, connectionMode: 'offline' });
        if (!silent && !hasTracks) {
          get().showToast(msg, 'error');
        }
      }
    },

    importLocalAudioFile: (file, customLyrics) => {
      const url = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.(mp3|m4a|wav|ogg|flac)$/i, '').replace(/[_-]+/g, ' ').trim();
      const now = new Date().toISOString();
      const seed = Math.floor(Date.now() / 1000);
      const lyricsText = customLyrics?.trim() || null;

      const newTrack: Track = {
        id: `local_${seed}`,
        sourceChannel: 'ملف محلي',
        sourceMessageId: seed,
        title: cleanTitle || 'مقطع MP3 محلي',
        titleNormalized: normalizeArabic(cleanTitle),
        poet: 'مستورد من جهازك',
        category: 'زوامل',
        durationSec: 180,
        fileSizeBytes: file.size,
        mimeType: file.type || 'audio/mpeg',
        storageProvider: 'local',
        streamUrl: url,
        coverUrl: null,
        palette: getDeterministicPalette(seed),
        publishedAt: now,
        updatedAt: now,
        hasLyrics: Boolean(lyricsText),
        lyrics: lyricsText,
        lyricsNormalized: normalizeArabic(lyricsText),
        playCount: 1,
        isDemoPreview: false,
      };

      set((s) => ({
        tracks: [newTrack, ...s.tracks],
        queueIds: [newTrack.id, ...s.queueIds],
        downloadedIds: [newTrack.id, ...s.downloadedIds],
      }));

      get().showToast(`تم استيراد "${newTrack.title}" وتشغيله الآن`, 'success');
      void get().playTrack(newTrack.id, undefined, 'player');
    },

    showToast: (text, tone = 'info') => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: { id: Date.now(), text, tone } });
      toastTimer = setTimeout(() => {
        set({ toast: null });
      }, 3400);
    },
  };
});
