import type { Track } from '@shared/types/track';

export interface AudioCallbacks {
  onTimeUpdate: (positionSec: number, durationSec: number) => void;
  onPlayStateChange: (isPlaying: boolean, isBuffering: boolean) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onRemoteNext: () => void;
  onRemotePrevious: () => void;
}

/**
 * طبقة تجريد محرك الصوت (Audio Abstraction Layer)
 * - على Chrome / Web: HTML5 Audio (بث متدرج فوري) + MediaSession API
 * - عند بناء APK للأندرويد لاحقاً: تُستبدل بـ react-native-track-player دون تعديل الواجهة
 */
class WebAudioEngine {
  private audio: HTMLAudioElement;
  private callbacks: AudioCallbacks | null = null;
  private currentTrackId: string | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('timeupdate', () => {
      this.callbacks?.onTimeUpdate(
        this.audio.currentTime || 0,
        Number.isFinite(this.audio.duration) ? this.audio.duration : 0
      );
    });

    this.audio.addEventListener('loadstart', () => {
      this.callbacks?.onPlayStateChange(false, true);
    });

    this.audio.addEventListener('playing', () => {
      this.callbacks?.onPlayStateChange(true, false);
    });

    this.audio.addEventListener('pause', () => {
      this.callbacks?.onPlayStateChange(false, false);
    });

    this.audio.addEventListener('waiting', () => {
      this.callbacks?.onPlayStateChange(false, true);
    });

    this.audio.addEventListener('canplay', () => {
      this.callbacks?.onPlayStateChange(!this.audio.paused, false);
    });

    this.audio.addEventListener('ended', () => {
      this.callbacks?.onPlayStateChange(false, false);
      this.callbacks?.onEnded();
    });

    this.audio.addEventListener('error', () => {
      this.callbacks?.onPlayStateChange(false, false);
      this.callbacks?.onError('تعذّر تشغيل هذا المقطع حالياً — ربما ما زال قيد التحسين في السحابة، جرّب مقطعاً آخر أو أعد المحاولة بعد لحظة.');
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

    this.currentTrackId = track.id;
    this.callbacks?.onPlayStateChange(false, true);

    if (this.audio.src !== track.streamUrl) {
      this.audio.src = track.streamUrl;
    }

    this.audio.playbackRate = playbackRate;
    this.updateMediaSessionMetadata(track);

    if (startPositionSec > 0) {
      const applyStart = () => {
        if (Number.isFinite(this.audio.duration) && startPositionSec < this.audio.duration - 2) {
          this.audio.currentTime = startPositionSec;
        }
        this.audio.removeEventListener('loadedmetadata', applyStart);
      };
      this.audio.addEventListener('loadedmetadata', applyStart);
    }

    try {
      await this.audio.play();
    } catch {
      this.callbacks?.onPlayStateChange(false, false);
    }
  }

  async play(): Promise<void> {
    if (!this.audio.src) return;
    try {
      await this.audio.play();
    } catch {
      this.callbacks?.onPlayStateChange(false, false);
    }
  }

  pause(): void {
    this.audio.pause();
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
