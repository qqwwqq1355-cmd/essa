import { create } from 'zustand';
import type { Track, TrackCategory } from '@shared/types/track';
import { normalizeArabic } from '@shared/arabic/normalize';
import { getDeterministicPalette } from '@shared/arabic/lyricsParser';
import type { ThemeMode } from '../theme/tokens';
import { buildPreviewCatalog } from '../data/previewCatalog';
import { audioEngine } from '../services/audio/AudioEngine';
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

const STORAGE_KEY = 'essa_alleth_app_state_v1';

const DEFAULT_PERSISTED: PersistedState = {
  theme: 'dark',
  lyricsFontSize: 21,
  keepScreenAwake: true,
  notificationsEnabled: true,
  cacheLimitMb: 500,
  apiBaseUrl: getDefaultApiBaseUrl(),
  favorites: ['preview_5412', 'preview_5395'],
  downloadedIds: ['preview_5412'],
  playlists: [
    {
      id: 'pl_favorites_mix',
      name: 'مختاراتي المفضلة',
      trackIds: ['preview_5412', 'preview_5408', 'preview_5395'],
      createdAt: new Date().toISOString(),
    },
  ],
  playProgress: {},
  recentSearches: ['الجبال', 'الفجر', 'الكرامة'],
  lastSyncAt: new Date().toISOString(),
};

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERSISTED;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const merged = { ...DEFAULT_PERSISTED, ...parsed };
    if (!merged.apiBaseUrl && DEFAULT_PERSISTED.apiBaseUrl) {
      merged.apiBaseUrl = DEFAULT_PERSISTED.apiBaseUrl;
    }
    return merged;
  } catch {
    return DEFAULT_PERSISTED;
  }
}

function savePersisted(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // تجاهل في حال امتلاء التخزين
  }
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface AppState extends PersistedState {
  // التصفح
  activeTab: ActiveTab;
  selectedCategory: TrackCategory | 'الكل';

  // المكتبة والمزامنة
  tracks: Track[];
  isSyncing: boolean;
  connectionMode: 'preview' | 'live';
  syncError: string | null;

  // حالة المشغّل الصوتي
  currentTrackId: string | null;
  queueIds: string[];
  isPlaying: boolean;
  isBuffering: boolean;
  positionSec: number;
  durationSec: number;
  playbackRate: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  sleepTimerEndsAt: number | null;

  // نوافذ ومنبثقات
  isPlayerOpen: boolean;
  playerInitialTab: 'player' | 'lyrics' | 'queue';
  lyricsShareTrackId: string | null;
  playlistPickerTrackId: string | null;
  downloadingIds: Record<string, number>;
  toast: ToastMessage | null;

  // إجراءات التصفح والمظهر
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedCategory: (cat: TrackCategory | 'الكل') => void;
  toggleTheme: () => void;
  setLyricsFontSize: (size: number) => void;
  toggleKeepScreenAwake: () => void;
  toggleNotifications: () => void;
  setCacheLimitMb: (mb: number) => void;
  setApiBaseUrl: (url: string) => void;

  // إجراءات المشغّل
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

  // المفضلة والتحميل وقوائم التشغيل والبحث
  toggleFavorite: (trackId: string) => void;
  downloadTrack: (trackId: string) => void;
  removeDownload: (trackId: string) => void;
  clearAllDownloads: () => void;
  createPlaylist: (name: string, initialTrackId?: string) => void;
  deletePlaylist: (playlistId: string) => void;
  toggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;

  // نوافذ مشاركة الكلمات وقوائم التشغيل
  openLyricsShare: (trackId: string) => void;
  closeLyricsShare: () => void;
  openPlaylistPicker: (trackId: string) => void;
  closePlaylistPicker: () => void;

  // المزامنة واستيراد MP3 محلي للتجربة
  syncWithTelegramApi: (customBaseUrl?: string) => Promise<void>;
  importLocalAudioFile: (file: File, customLyrics?: string) => void;
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
}

const initialPersisted = loadPersisted();
const initialTracks = buildPreviewCatalog();

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
  // ربط أحداث محرك الصوت بالـ Store
  audioEngine.bindCallbacks({
    onTimeUpdate: (pos, dur) => {
      const state = get();
      const trackId = state.currentTrackId;
      const updates: Partial<AppState> = {
        positionSec: pos,
        durationSec: dur > 0 ? dur : state.durationSec,
      };
      // حفظ التقدم كل 5 ثوانٍ تقريباً لاستئناف الاستماع
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
  });

  // مراقبة مؤقت النوم
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
    isSyncing: false,
    connectionMode: initialPersisted.apiBaseUrl ? 'live' : 'preview',
    syncError: null,

    currentTrackId: initialTracks[0]?.id ?? null,
    queueIds: initialTracks.map((t) => t.id),
    isPlaying: false,
    isBuffering: false,
    positionSec: 0,
    durationSec: initialTracks[0]?.durationSec ?? 0,
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
        const updated = { ...s, theme: next };
        persistFromState(updated);
        return { theme: next };
      });
    },

    setLyricsFontSize: (lyricsFontSize) => {
      const clamped = Math.min(30, Math.max(15, lyricsFontSize));
      set((s) => {
        const updated = { ...s, lyricsFontSize: clamped };
        persistFromState(updated);
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
      const cleaned = apiBaseUrl.trim().replace(/\/+$/, '');
      set((s) => {
        persistFromState({ ...s, apiBaseUrl: cleaned });
        return { apiBaseUrl: cleaned, connectionMode: cleaned ? 'live' : 'preview' };
      });
    },

    playTrack: async (trackId, queueOverride, openTab) => {
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
        positionSec: resumePos,
        durationSec: track.durationSec,
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

      if (audioEngine.getCurrentTrackId() !== state.currentTrackId) {
        await state.playTrack(state.currentTrackId);
        return;
      }

      if (state.isPlaying) {
        audioEngine.pause();
      } else {
        await audioEngine.play();
      }
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
      set((s) => {
        const next = !s.shuffle;
        return { shuffle: next };
      });
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
      if (state.downloadedIds.includes(trackId) || state.downloadingIds[trackId] !== undefined) {
        return;
      }
      set((s) => ({ downloadingIds: { ...s.downloadingIds, [trackId]: 15 } }));

      let progress = 15;
      const timer = setInterval(() => {
        progress += 28;
        if (progress >= 100) {
          clearInterval(timer);
          set((s) => {
            const nextDownloading = { ...s.downloadingIds };
            delete nextDownloading[trackId];
            const downloadedIds = s.downloadedIds.includes(trackId)
              ? s.downloadedIds
              : [trackId, ...s.downloadedIds];
            persistFromState({ ...s, downloadedIds });
            return { downloadingIds: nextDownloading, downloadedIds };
          });
          get().showToast('تم حفظ المقطع للاستماع بدون إنترنت', 'success');
        } else {
          set((s) => ({
            downloadingIds: { ...s.downloadingIds, [trackId]: progress },
          }));
        }
      }, 240);
    },

    removeDownload: (trackId) => {
      set((s) => {
        const downloadedIds = s.downloadedIds.filter((id) => id !== trackId);
        persistFromState({ ...s, downloadedIds });
        return { downloadedIds };
      });
      get().showToast('تم حذف المقطع من التحميلات المحلية', 'info');
    },

    clearAllDownloads: () => {
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

    syncWithTelegramApi: async (customBaseUrl) => {
      const state = get();
      const targetUrl = (customBaseUrl ?? state.apiBaseUrl).trim().replace(/\/+$/, '');

      set({ isSyncing: true, syncError: null });

      if (!targetUrl) {
        // وضع المعاينة المحلي: محاكاة تحديث سريع مع شرح واضح
        await new Promise((r) => setTimeout(r, 650));
        const now = new Date().toISOString();
        set((s) => {
          persistFromState({ ...s, lastSyncAt: now });
          return { isSyncing: false, lastSyncAt: now, connectionMode: 'preview' };
        });
        get().showToast('تم تحديث مكتبة المعاينة — أضف رابط Edge API في الإعدادات للربط المباشر بـ @IssaAllaith', 'info');
        return;
      }

      try {
        const response = await fetchDeltaSync(targetUrl);
        const liveTracks = response.tracks.filter((t) => !t.isDeleted);
        const now = response.serverTime || new Date().toISOString();

        set((s) => {
          persistFromState({ ...s, apiBaseUrl: targetUrl, lastSyncAt: now });
          return {
            tracks: liveTracks.length > 0 ? liveTracks : s.tracks,
            queueIds: liveTracks.length > 0 ? liveTracks.map((t) => t.id) : s.queueIds,
            apiBaseUrl: targetUrl,
            lastSyncAt: now,
            connectionMode: 'live',
            isSyncing: false,
            syncError: null,
          };
        });
        get().showToast(`تمت المزامنة بنجاح مع @${response.sourceChannel} (${liveTracks.length} مقطع)`, 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذّر الاتصال بخادم المزامنة';
        set({ isSyncing: false, syncError: msg });
        get().showToast(msg, 'error');
      }
    },

    importLocalAudioFile: (file, customLyrics) => {
      const url = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.(mp3|m4a|wav|ogg|flac)$/i, '').replace(/[_-]+/g, ' ').trim();
      const now = new Date().toISOString();
      const seed = Math.floor(Date.now() / 1000);
      const lyricsText =
        customLyrics?.trim() ||
        `ملف MP3 محلي مُضاف للتجربة الفورية\nالعنوان: ${cleanTitle}\nيمكنك الاستماع والتحكم بسرعة التشغيل ومؤقت النوم بشكل كامل.`;

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
        hasLyrics: true,
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

