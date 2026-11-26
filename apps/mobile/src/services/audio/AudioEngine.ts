import type { Track } from '@shared/types/track';
import {
  abortBackgroundCaching,
  cacheAudioInBackground,
  getMemoryCachedAudioUrl,
} from './audioCache';
import { pauseImageLoading, resumeImageLoading } from '../images/imageLoader';

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
  updateNowPlaying?: (title: string, artist: string, coverUrl: string, isPlaying: boolean) => void;
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
  private currentArtist = 'عيسى الليث';
  private currentCover = '';
  private loadToken = 0;
  private pendingMetaHandler: (() => void) | null = null;
  private pendingCacheTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCacheTarget: { url: string; trackId: string; token: number } | null = null;

  constructor() {
    this.audio = this.createAudioElement();
  }

  private createAudioElement(): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'auto';

    const getBufferedSec = () => {
      try {
        const b = el.buffered;
        if (b && b.length > 0) {
          return b.end(b.length - 1);
        }
      } catch {
        // تجاهل
      }
      return 0;
    };

    const emitTime = () => {
      if (this.audio !== el) return;
      const pos = el.currentTime || 0;
      const dur = Number.isFinite(el.duration) ? el.duration : 0;
      this.callbacks?.onTimeUpdate(pos, dur, getBufferedSec());
    };

    el.addEventListener('timeupdate', () => {
      if (this.audio !== el) return;
      emitTime();
      if (!el.paused && this.wantToPlay) {
        this.callbacks?.onPlayStateChange(true, false);
      }
    });

    el.addEventListener('progress', () => {
      if (this.audio !== el) return;
      emitTime();
    });

    el.addEventListener('loadedmetadata', () => {
      if (this.audio !== el) return;
      emitTime();
    });

    el.addEventListener('loadstart', () => {
      if (this.audio !== el) return;
      if (this.wantToPlay) {
        this.callbacks?.onPlayStateChange(true, true);
      }
    });

    el.addEventListener('playing', () => {
      if (this.audio !== el) return;
      // بدأ الصوت فعلياً → نستأنف تحميل الصور بعد ثانية، ونبدأ الحفظ الخلفي بعد 4 ثوانٍ فقط
      setTimeout(resumeImageLoading, 1000);
      if (this.pendingCacheTarget && this.pendingCacheTarget.token === this.loadToken) {
        const target = this.pendingCacheTarget;
        this.pendingCacheTarget = null;
        if (this.pendingCacheTimer) clearTimeout(this.pendingCacheTimer);
        this.pendingCacheTimer = setTimeout(() => {
          if (target.token !== this.loadToken || !this.wantToPlay) return;
          cacheAudioInBackground(target.url, () => {
            this.callbacks?.onTrackCached?.(target.trackId);
          });
        }, 15000);
      }
      this.wantToPlay = true;
      this.callbacks?.onPlayStateChange(true, false);
      this.notifyNative(true);
    });

    el.addEventListener('pause', () => {
      if (this.audio !== el) return;
      if (!this.wantToPlay) {
        this.callbacks?.onPlayStateChange(false, false);
        this.notifyNative(false);
      }
    });

    el.addEventListener('waiting', () => {
      if (this.audio !== el) return;
      if (this.wantToPlay) {
        this.callbacks?.onPlayStateChange(true, true);
      }
    });

    el.addEventListener('canplay', () => {
      if (this.audio !== el) return;
      this.callbacks?.onPlayStateChange(this.wantToPlay && !el.paused, false);
    });

    el.addEventListener('ended', () => {
      if (this.audio !== el) return;
      this.wantToPlay = false;
      this.callbacks?.onPlayStateChange(false, false);
      this.callbacks?.onEnded();
    });

    el.addEventListener('error', () => {
      if (this.audio !== el) return;
      resumeImageLoading();
      if (!el.getAttribute('src')) return;
      this.wantToPlay = false;
      this.callbacks?.onPlayStateChange(false, false);
      this.callbacks?.onError('تعذّر تشغيل هذا المقطع حالياً — جرّب إعادة المحاولة أو اختر مقطعاً آخر.');
    });

    return el;
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

  private notifyNative(isPlaying: boolean) {
    const bridge = getAndroidBridge();
    if (!bridge) return;
    if (bridge.updateNowPlaying) {
      bridge.updateNowPlaying(
        this.currentTrackTitle,
        this.currentArtist,
        this.currentCover,
        isPlaying
      );
    } else {
      bridge.onPlaybackStateChanged?.(isPlaying, this.currentTrackTitle);
    }
  }

  private updateMediaSessionMetadata(track: Track) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const artworkUrl = track.coverUrl || '/app-icon.jpg';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.poet ? `عيسى الليث • ${track.poet}` : 'عيسى الليث',
        album: track.category || 'مكتبة عيسى الليث',
        artwork: [
          { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
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
    this.currentArtist = track.poet ? `عيسى الليث • ${track.poet}` : 'عيسى الليث';
    this.currentCover = track.coverUrl || '';
    // الإشعار يظهر فوراً باسم الزامل الجديد وغلافه وأزرار التحكم
    this.notifyNative(true);

    if (this.pendingMetaHandler) {
      this.audio.removeEventListener('loadedmetadata', this.pendingMetaHandler);
      this.pendingMetaHandler = null;
    }
    if (this.pendingCacheTimer) {
      clearTimeout(this.pendingCacheTimer);
      this.pendingCacheTimer = null;
    }
    // إلغاء أي تنزيل خلفي للزامل السابق + إيقاف كل طلبات الصور فوراً ليأخذ الصوت كامل الشبكة
    abortBackgroundCaching();
    pauseImageLoading(6000);

    // إيقاف فوري للمشغّل القديم وإنشاء عنصر Audio نظيف تماماً للزامل الجديد (لفتح فوري مثل أول زامل!)
    const oldAudio = this.audio;
    oldAudio.pause();
    oldAudio.removeAttribute('src');
    oldAudio.load();

    const nextAudio = this.createAudioElement();
    this.audio = nextAudio;
    this.callbacks?.onPlayStateChange(true, true);

    // تشغيل متزامن فوري (0ms بدون أي await قبل play) للحفاظ على استجابة النقر الفورية في Chrome!
    const cachedUrl = getMemoryCachedAudioUrl(track.streamUrl);
    nextAudio.src = cachedUrl ?? track.streamUrl;
    nextAudio.playbackRate = playbackRate;
    this.updateMediaSessionMetadata(track);

    // لا نبدأ الحفظ الخلفي إلا بعد أن يبدأ الصوت فعلياً (حدث playing) حتى لا يُرسل طلب ثانٍ أبداً أثناء الفتح!
    this.pendingCacheTarget =
      !cachedUrl && track.storageProvider !== 'local'
        ? { url: track.streamUrl, trackId: track.id, token }
        : null;

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
    this.notifyNative(false);
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
