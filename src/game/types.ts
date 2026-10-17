import { ImageSourcePropType } from 'react-native';

export type Bank = 'start' | 'goal';

/** Where a level takes place: rowing across a river, or walking a bridge by torchlight. */
export type Setting = 'river' | 'bridge';

export interface Character {
  id: string;
  name: string;
  image: ImageSourcePropType;
  /** Whether this character can row the boat (or, on a bridge, carry the torch). */
  canRow: boolean;
  /** Optional coloured badge, used to pair characters (e.g. couples). */
  tag?: { label: string; color: string };
  /** Weight in kg, for levels with a weight-limited boat. */
  weight?: number;
  /** Minutes this character needs to cross, for timed levels. */
  minutes?: number;
}

export interface Level {
  id: string;
  title: string;
  /** Characters shown on the level card. */
  cover: ImageSourcePropType[];
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  description: string;
  rules: string[];
  /** Defaults to 'river'. */
  setting?: Setting;
  boatCapacity: number;
  characters: Character[];
  /**
   * Timed levels: every crossing takes as long as its slowest member, and
   * everyone must be across within this many minutes.
   */
  timeLimit?: number;
  /**
   * Checks a group of characters that are together without anyone else
   * (a river bank, or the people in the boat). Returns a message describing
   * what went wrong, or null when the group is safe.
   */
  checkGroup: (ids: string[]) => string | null;
  /** Extra condition on who may leave in the boat (weight limits etc.). */
  boatCheck?: (ids: string[]) => string | null;
}

export interface GameState {
  positions: Record<string, Bank>;
  boatSide: Bank;
}
