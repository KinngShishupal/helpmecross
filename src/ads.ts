import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

/**
 * Ad unit IDs. These are Google's public test units, which always serve test
 * ads. Before publishing, replace them with your own AdMob units (and the app
 * IDs in app.json).
 */
export const AD_UNITS = {
  interstitial: TestIds.INTERSTITIAL,
  banner: TestIds.BANNER,
};

/** How many interstitials play before a hint is revealed. */
export const ADS_PER_HINT = 2;

/** Give up on an ad that hasn't loaded after this long, so players are never stuck. */
const LOAD_TIMEOUT_MS = 8000;

let initialized: Promise<unknown> | null = null;

export function initAds() {
  initialized ??= mobileAds().initialize().catch(() => undefined);
  return initialized;
}

/** Loads and shows one interstitial; resolves when it closes, fails or times out. */
function showOne(): Promise<void> {
  return new Promise(resolve => {
    const ad = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      ad.removeAllListeners();
      resolve();
    };
    const timer = setTimeout(finish, LOAD_TIMEOUT_MS);
    ad.addAdEventListener(AdEventType.LOADED, () => {
      clearTimeout(timer);
      ad.show().catch(finish);
    });
    ad.addAdEventListener(AdEventType.CLOSED, finish);
    ad.addAdEventListener(AdEventType.ERROR, finish);
    ad.load();
  });
}

/**
 * Shows `count` interstitials one after another. `onProgress` is called with
 * the 1-based number of the ad about to play.
 */
export async function showAdsInARow(count: number, onProgress?: (n: number) => void) {
  await initAds();
  for (let n = 1; n <= count; n++) {
    onProgress?.(n);
    await showOne();
  }
}
