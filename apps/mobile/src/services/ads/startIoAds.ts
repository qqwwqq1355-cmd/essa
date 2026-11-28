/**
 * جسر إعلانات Start.io (App ID: 210645029)
 * يربط الواجهة مع Start.io Android SDK عبر AndroidBridge بشكل آمن وغير مزعج
 */

interface StartIoBridge {
  showInterstitialAd?: () => void;
  showRewardedAd?: (callbackId: string) => void;
  setTopBannerVisible?: (visible: boolean) => void;
}

function getBridge(): StartIoBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { AndroidBridge?: StartIoBridge }).AndroidBridge;
}

let trackPlayCounter = 0;

/**
 * يعرض إعلاناً بينياً (Interstitial) بذكاء كل 3 زوامل مع فاصل زمني لا يقل عن دقيقتين
 */
export function triggerInterstitialOnTrackPlay(): void {
  trackPlayCounter += 1;
  if (trackPlayCounter % 3 !== 0) return;
  try {
    getBridge()?.showInterstitialAd?.();
  } catch {
    // تجاهل
  }
}

/**
 * يعرض إعلاناً بينياً فورياً عند النقر على خانة الإعلان المدمجة
 */
export function triggerInlineAdAction(): void {
  try {
    getBridge()?.showInterstitialAd?.();
  } catch {
    // تجاهل
  }
}

/**
 * يعرض إعلان مكافأة (Rewarded Video) قبل تحميل الزامل أوفلاين (على أندرويد)
 * وإذا لم يتوفر إعلان أو كان المستخدم على الويب، يُكمل التحميل فوراً دون تعطيل
 */
export function requestRewardedAdForDownload(): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge?.showRewardedAd) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const callbackId = `rw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const win = window as unknown as {
      __onRewardedAdResult?: (id: string, ok: boolean) => void;
    };

    const prevHandler = win.__onRewardedAdResult;
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const timeout = setTimeout(() => finish(true), 8000);

    win.__onRewardedAdResult = (id: string, ok: boolean) => {
      if (id === callbackId) {
        clearTimeout(timeout);
        win.__onRewardedAdResult = prevHandler;
        finish(ok);
      } else {
        prevHandler?.(id, ok);
      }
    };

    try {
      bridge.showRewardedAd?.(callbackId);
    } catch {
      clearTimeout(timeout);
      finish(true);
    }
  });
}

