import { Platform } from 'react-native';
import mobileAds, { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

/** Live AdMob units for the Android app (app ID is in app.json). */
const ANDROID_UNITS = {
  banner: 'ca-app-pub-8284285672679424/7068116930',
  rewarded: 'ca-app-pub-8284285672679424/5330784424',
};

/**
 * Debug builds always use Google's test units so you never tap your own live
 * ads. iOS has no AdMob app yet, so it stays on test units too.
 */
const live = Platform.OS === 'android' && !__DEV__;

export const AD_UNITS = {
  banner: live ? ANDROID_UNITS.banner : TestIds.BANNER,
  rewarded: live ? ANDROID_UNITS.rewarded : TestIds.REWARDED,
};

/** Give up on an ad that hasn't loaded after this long, so players are never stuck. */
const LOAD_TIMEOUT_MS = 8000;

let initialized: Promise<unknown> | null = null;

export function initAds() {
  initialized ??= mobileAds().initialize().catch(() => undefined);
  return initialized;
}

/**
 * Loads and shows one rewarded ad. Resolves `true` when the player earned the
 * reward, or when no ad could be shown (so a missing ad never blocks a hint),
 * and `false` when they closed the ad before earning it.
 */
export async function showRewardedAd(): Promise<boolean> {
  await initAds();
  return new Promise(resolve => {
    const ad = RewardedAd.createForAdRequest(AD_UNITS.rewarded);
    let shown = false;
    let earned = false;
    let finished = false;
    const finish = (result: boolean) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      ad.removeAllListeners();
      resolve(result);
    };
    const timer = setTimeout(() => finish(true), LOAD_TIMEOUT_MS);
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      clearTimeout(timer);
      shown = true;
      ad.show().catch(() => finish(true));
    });
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned));
    ad.addAdEventListener(AdEventType.ERROR, () => finish(!shown || earned));
    ad.load();
  });
}
