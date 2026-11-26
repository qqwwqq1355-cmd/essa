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

export type ActiveTab = 'home' | 'search' | 'library' | 'settings';
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

function loadCachedTracks(): Track[] {
  try {
    const raw = localStorage.getItem(TRACKS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Track[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && !t.isDemoPreview && isNotPreviewId(t.id));
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
      get().showToast(msg, 'error');
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

      set({
        currentTrackId: trackId,
        queueIds: ensuredQueue,
        isPlaying: true,
        isBuffering: true,
        positionSec: resumePos,
        durationSec: track.durationSec,
        bufferedSec: 0,
        isPlayerOpen: openTab ? true : state.isPlayerOpen,
        playerInitialTab: openTab ?? state.playerInitialTab,
      });

      await audioEngine.loadAndPlay(track, resumePos, state.playbackRate);
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

      void saveAudioToDevice(track.streamUrl, track.title).then((ok) => {
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
      });
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
        // 1) تحميل الفهرس والصور المدمجة داخل التطبيق فوراً (0ms أوفلاين!) إذا لم تكن القائمة محمّلة بعد
        if (state.tracks.length === 0) {
          try {
            const localRes = await fetch('/offline/catalog.json');
            if (localRes.ok) {
              const localData = (await localRes.json()) as { tracks?: Track[] };
              if (Array.isArray(localData.tracks) && localData.tracks.length > 0) {
                set((s) => ({
                  tracks: localData.tracks!,
                  currentTrackId: s.currentTrackId ?? localData.tracks![0]?.id ?? null,
                  queueIds: localData.tracks!.map((t) => t.id),
                }));
              }
            }
          } catch {
            // تجاهل في بيئة التطوير إذا لم يُبنَ الفهرس المدمج بعد
          }
        }

        const response = await fetchDeltaSync(targetUrl);
        const existingCoverById = new Map(
          get()
            .tracks.filter((t) => t.coverUrl?.startsWith('/offline/covers/'))
            .map((t) => [t.id, t.coverUrl!])
        );
        const liveTracks = response.tracks
          .filter((t) => !t.isDeleted)
          .map((t) => {
            const bundledCover = existingCoverById.get(t.id);
            return bundledCover ? { ...t, coverUrl: bundledCover } : t;
          });
        const localImported = state.tracks.filter((t) => t.storageProvider === 'local');
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
          get().showToast(`تم تحديث المكتبة من @${response.sourceChannel} (${liveTracks.length} زامل)`, 'success');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذّر الاتصال بالخادم — تعمل المكتبة بالوضع المحلي';
        set({ isSyncing: false, syncError: msg, connectionMode: 'offline' });
        if (!silent) {
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
