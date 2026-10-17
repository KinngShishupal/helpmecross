/* global jest */
// The ads SDK is native-only; give tests a lightweight stand-in.
jest.mock('react-native-google-mobile-ads', () => {
  const ad = {
    addAdEventListener: () => () => {},
    removeAllListeners: () => {},
    load: () => {},
    show: () => Promise.resolve(),
  };
  return {
    __esModule: true,
    default: () => ({ initialize: () => Promise.resolve([]) }),
    InterstitialAd: { createForAdRequest: () => ad },
    BannerAd: () => null,
    BannerAdSize: { BANNER: 'BANNER' },
    AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
    TestIds: { INTERSTITIAL: 'test-interstitial', BANNER: 'test-banner' },
  };
});
