import { NativeModules } from 'react-native';

/** Native audio engine (android/.../GameAudioModule.kt). Absent on iOS. */
const native:
  | {
      preload: (names: string[]) => void;
      play: (name: string, volume: number) => void;
      playMusic: (name: string, volume: number) => void;
      stopMusic: () => void;
    }
  | undefined = NativeModules.GameAudio;

export type Sfx =
  | 'sfx_click'
  | 'sfx_board'
  | 'sfx_unboard'
  | 'sfx_row'
  | 'sfx_walk'
  | 'sfx_arrive'
  | 'sfx_error'
  | 'sfx_win'
  | 'sfx_lose';

const ALL_SFX: Sfx[] = [
  'sfx_click',
  'sfx_board',
  'sfx_unboard',
  'sfx_row',
  'sfx_walk',
  'sfx_arrive',
  'sfx_error',
  'sfx_win',
  'sfx_lose',
];

const MUSIC_VOLUME = 0.35;
let soundOn = true;

export const audio = {
  init() {
    native?.preload(ALL_SFX);
  },
  play(name: Sfx, volume = 1) {
    if (soundOn) {
      native?.play(name, volume);
    }
  },
  setSound(on: boolean) {
    soundOn = on;
  },
  setMusic(on: boolean) {
    if (on) {
      native?.playMusic('music_theme', MUSIC_VOLUME);
    } else {
      native?.stopMusic();
    }
  },
};
