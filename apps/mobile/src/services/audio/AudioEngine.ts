import type { Track } from '@shared/types/track';
import { cacheAudioInBackground, getCachedAudioUrl } from './audioCache';

export interface AudioCallbacks {
  onTimeUpdate: (positionSec: number, durationSec: number, bufferedSec: number) => void;
  onPlayStateChange: (isPlaying: boolean, isBuffering: boolean) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onRemoteNext: () => void;
  onRemotePrevious: () => void;
  onTrackCached?: (trackId: string) => void;
}

/**
 * طبقة تجريد محرك الصوت (Audio Abstraction Layer)
 * - على Chrome / Web: HTML5 Audio (بث متدرج فوري) + MediaSession API
 * - عند بناء APK للأندرويد لاحقاً: تُستبدل بـ react-native-track-player دون تعديل الواجهة
 */
interface NativeAndroidBridge {
  onPlaybackStateChanged?: (isPlaying: boolean, title: string) => void;
  saveBase64Png?: (dataUrl: string, fileName: string) => void;
}

function getAndroidBridge(): NativeAndroidBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { AndroidBridge?: NativeAndroidBridge }).AndroidBridge;
}

class WebAudioEngine {
  private audio: HTMLAudioElement;
  private callbacks: AudioCallbacks | null = null;
  private currentTrackId: string | null = null;
  private currentTrackTitle = 'مكتبة عيسى الليث';
  private wantToPlay = false;
  private loadToken = 0;
  private pendingMetaHandler: (() => void) | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    const getBufferedSec = () => {
      try {
        const b = this.audio.buffered;
        if (b && b.length > 0) {
          return b.end(b.length - 1);
        }
      } catch {
        // تجاهل
      }
      return 0;
    };

    const emitTime = () => {
      const pos = this.audio.currentTime || 0;
      const dur = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
      this.callbacks?.onTimeUpdate(pos, dur, getBufferedSec());
    };

    this.audio.addEventListener('timeupdate', () => {
      emitTime();
      if (!this.audio.paused && this.wantToPlay) {
        this.callbacks?.onPlayStateChange(true, false);
      }
    });

    this.audio.addEventListener('progress', () => {
      emitTime();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      emitTime();
    });

    this.audio.addEventListener('loadstart', () => {
      if (this.wantToPlay) {
        this.callbacks?.onPlayStateChange(true, true);
      }
    });

    this.audio.addEventListener('playing', () => {
      this.wantToPlay = true;
      this.callbacks?.onPlayStateChange(true, false);
      getAndroidBridge()?.onPlaybackStateChanged?.(true, this.currentTrackTitle);
    });

    this.audio.addEventListener('pause', () => {
      // لا نغيّر الحالة إذا كنا في منتصف تبديل لمقطع جديد
      if (!this.wantToPlay) {
        this.callbacks?.onPlayStateChange(false, false);
        getAndroidBridge()?.onPlaybackStateChanged?.(false, this.currentTrackTitle);
      }
    });

    this.audio.addEventListener('waiting', () => {
      if (this.wantToPlay) {
        this.callbacks?.onPlayStateChange(true, true);
      }
    });

    this.audio.addEventListener('canplay', () => {
      this.callbacks?.onPlayStateChange(this.wantToPlay && !this.audio.paused, false);
    });

    this.audio.addEventListener('ended', () => {
      this.wantToPlay = false;
      this.callbacks?.onPlayStateChange(false, false);
      this.callbacks?.onEnded();
    });

    this.audio.addEventListener('error', () => {
      // تجاهل أخطاء التفريغ عند إيقاف أو تبديل مقطع
      if (!this.audio.getAttribute('src')) return;
      this.wantToPlay = false;
      this.callbacks?.onPlayStateChange(false, false);
      this.callbacks?.onError('تعذّر تشغيل هذا المقطع حالياً — جرّب إعادة المحاولة أو اختر مقطعاً آخر.');
    });
  }

  bindCallbacks(callbacks: AudioCallbacks) {
    this.callbacks = callbacks;
    this.bindMediaSessionHandlers();
  }

  private bindMediaSessionHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        void this.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.callbacks?.onRemoteNext();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.callbacks?.onRemotePrevious();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          this.seekTo(details.seekTime);
        }
      });
    } catch {
      // تجاهل
    }
  }

  private updateMediaSessionMetadata(track: Track) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: 'عيسى الليث',
        album: track.category || 'مكتبة عيسى الليث',
      });
    } catch {
      // تجاهل
    }
  }

  async loadAndPlay(track: Track, startPositionSec = 0, playbackRate = 1): Promise<void> {
    if (!track.streamUrl) {
      this.callbacks?.onError('رابط البث غير متوفر لهذا المقطع بعد.');
      return;
    }

    const token = ++this.loadToken;
    this.wantToPlay = true;
    this.currentTrackId = track.id;
    this.currentTrackTitle = track.title;

    if (this.pendingMetaHandler) {
      this.audio.removeEventListener('loadedmetadata', this.pendingMetaHandler);
      this.pendingMetaHandler = null;
    }

    // إيقاف فوري للمقطع السابق وتجهيز الجديد بدون تعارض
    this.audio.pause();
    this.callbacks?.onPlayStateChange(true, true);

    // إذا كان المقطع محفوظاً محلياً نُشغّله فوراً من الكاش أوفلاين، وإلا نُشغّله بالبث السريع ونحفظه في الخلفية
    const cachedUrl = await getCachedAudioUrl(track.streamUrl);
    if (token !== this.loadToken) return;

    this.audio.src = cachedUrl ?? track.streamUrl;
    this.audio.load();
    this.audio.playbackRate = playbackRate;
    this.updateMediaSessionMetadata(track);

    if (!cachedUrl && track.storageProvider !== 'local') {
      cacheAudioInBackground(track.streamUrl, () => {
        this.callbacks?.onTrackCached?.(track.id);
      });
    }

    if (startPositionSec > 0) {
      const applyStart = () => {
        if (token !== this.loadToken) return;
        if (Number.isFinite(this.audio.duration) && startPositionSec < this.audio.duration - 2) {
          this.audio.currentTime = startPositionSec;
        }
        if (this.pendingMetaHandler === applyStart) {
          this.audio.removeEventListener('loadedmetadata', applyStart);
          this.pendingMetaHandler = null;
        }
      };
      this.pendingMetaHandler = applyStart;
      this.audio.addEventListener('loadedmetadata', applyStart);
    }

    try {
      await this.audio.play();
      if (token === this.loadToken && this.wantToPlay) {
        this.callbacks?.onPlayStateChange(true, false);
      }
    } catch (err) {
      // تجاهل AbortError عند التبديل السريع لمقطع آخر أو الإيقاف اليدوي
      if (token !== this.loadToken || !this.wantToPlay) return;
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort) {
        this.wantToPlay = false;
        this.callbacks?.onPlayStateChange(false, false);
      }
    }
  }

  async play(): Promise<void> {
    if (!this.audio.src) return;
    const token = ++this.loadToken;
    this.wantToPlay = true;
    this.callbacks?.onPlayStateChange(true, this.audio.readyState < 3);
    try {
      await this.audio.play();
      if (token === this.loadToken && this.wantToPlay) {
        this.callbacks?.onPlayStateChange(true, false);
      }
    } catch {
      if (token !== this.loadToken || !this.wantToPlay) return;
      this.wantToPlay = false;
      this.callbacks?.onPlayStateChange(false, false);
    }
  }

  pause(): void {
    this.loadToken++;
    this.wantToPlay = false;
    this.audio.pause();
    this.callbacks?.onPlayStateChange(false, false);
    getAndroidBridge()?.onPlaybackStateChanged?.(false, this.currentTrackTitle);
  }

  seekTo(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    const max = Number.isFinite(this.audio.duration) ? this.audio.duration : seconds;
    this.audio.currentTime = Math.max(0, Math.min(seconds, max));
  }

  setPlaybackRate(rate: number): void {
    this.audio.playbackRate = rate;
  }

  getCurrentTrackId(): string | null {
    return this.currentTrackId;
  }
}

export const audioEngine = new WebAudioEngine();
