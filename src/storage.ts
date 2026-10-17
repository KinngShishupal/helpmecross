import { NativeModules } from 'react-native';

/** Native key-value store (android/.../GameStorageModule.kt). Absent on iOS, where progress lasts one session. */
const native:
  | {
      getItem: (key: string) => Promise<string | null>;
      setItem: (key: string, value: string) => void;
    }
  | undefined = NativeModules.GameStorage;

const PROGRESS_KEY = 'progress';

/** Best score per stage id, for every stage the player has cleared. */
export type Progress = Record<string, number>;

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await native?.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress: Progress) {
  native?.setItem(PROGRESS_KEY, JSON.stringify(progress));
}
