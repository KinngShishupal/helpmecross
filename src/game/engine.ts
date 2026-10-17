import { Bank, GameState, Level } from './types';

export const otherBank = (bank: Bank): Bank =>
  bank === 'start' ? 'goal' : 'start';

export const isBridge = (level: Level) => level.setting === 'bridge';

/** Words for the thing that carries people across, so messages fit the setting. */
export function vocab(level: Level) {
  return isBridge(level)
    ? {
        wrongSide: 'The torch is on the other side.',
        full: (n: number) => `Only ${n} can be on the bridge at once.`,
        empty: 'Choose who walks across first.',
        noRower: 'Someone has to carry the torch!',
        board: 'Tap people to send them onto the bridge',
      }
    : {
        wrongSide: 'The boat is on the other bank.',
        full: (n: number) => `The boat only holds ${n}.`,
        empty: 'Put someone in the boat first.',
        noRower: 'Nobody in the boat can row!',
        board: 'Tap people to board',
      };
}

export function initialState(level: Level): GameState {
  const positions: Record<string, Bank> = {};
  level.characters.forEach(c => {
    positions[c.id] = 'start';
  });
  return { positions, boatSide: 'start' };
}

export function idsOnBank(level: Level, state: GameState, bank: Bank) {
  return level.characters
    .map(c => c.id)
    .filter(id => state.positions[id] === bank);
}

/** Reasons the boat cannot leave with this group, or null if it can. */
export function departureError(level: Level, group: string[]): string | null {
  const words = vocab(level);
  if (group.length === 0) {
    return words.empty;
  }
  if (group.length > level.boatCapacity) {
    return words.full(level.boatCapacity);
  }
  const canRow = level.characters.some(
    c => group.includes(c.id) && c.canRow,
  );
  if (!canRow) {
    return words.noRower;
  }
  return level.boatCheck?.(group) ?? null;
}

/** Minutes a crossing takes: the pace of the slowest member (0 on untimed levels). */
export function crossingTime(level: Level, group: string[]): number {
  if (level.timeLimit === undefined) {
    return 0;
  }
  return Math.max(
    0,
    ...level.characters.filter(c => group.includes(c.id)).map(c => c.minutes ?? 1),
  );
}

export function timeUp(level: Level, elapsed: number): string | null {
  return level.timeLimit !== undefined && elapsed > level.timeLimit
    ? `Out of time! That took ${elapsed} minutes, but the limit is ${level.timeLimit}.`
    : null;
}

export function cross(state: GameState, group: string[]): GameState {
  const to = otherBank(state.boatSide);
  const positions = { ...state.positions };
  group.forEach(id => {
    positions[id] = to;
  });
  return { positions, boatSide: to };
}

/** Checks the boat group during the crossing and both banks afterwards. */
export function findViolation(
  level: Level,
  next: GameState,
  group: string[],
): string | null {
  return (
    level.checkGroup(group) ??
    level.checkGroup(idsOnBank(level, next, 'start')) ??
    level.checkGroup(idsOnBank(level, next, 'goal'))
  );
}

export const isWon = (level: Level, state: GameState) =>
  level.characters.every(c => state.positions[c.id] === 'goal');

const stateKey = (level: Level, state: GameState) =>
  state.boatSide +
  level.characters.map(c => (state.positions[c.id] === 'goal' ? 1 : 0)).join('');

function combinations(items: string[], maxSize: number): string[][] {
  const result: string[][] = [];
  const walk = (start: number, current: string[]) => {
    if (current.length > 0) {
      result.push(current);
    }
    if (current.length === maxSize) {
      return;
    }
    for (let i = start; i < items.length; i++) {
      walk(i + 1, [...current, items[i]]);
    }
  };
  walk(0, []);
  return result;
}

/** Every legal crossing from `state`, with the state it leads to. */
function moves(level: Level, state: GameState) {
  const available = idsOnBank(level, state, state.boatSide);
  return combinations(available, level.boatCapacity)
    .filter(group => !departureError(level, group))
    .map(group => ({ group, next: cross(state, group) }))
    .filter(({ group, next }) => !findViolation(level, next, group));
}

/**
 * Finds the best way to finish from `state`, returning the groups to send
 * across, or null if the level can no longer be won.
 *
 * Untimed levels minimise the number of crossings (breadth-first search).
 * Timed levels minimise the total minutes (Dijkstra), given `elapsed`
 * minutes already used, and fail if the time limit cannot be met.
 */
export function solve(level: Level, state: GameState, elapsed = 0): string[][] | null {
  if (isWon(level, state)) {
    return [];
  }
  return level.timeLimit === undefined ? fewestCrossings(level, state) : fastest(level, state, elapsed);
}

function fewestCrossings(level: Level, state: GameState): string[][] | null {
  const seen = new Set([stateKey(level, state)]);
  const queue: { state: GameState; path: string[][] }[] = [{ state, path: [] }];
  while (queue.length > 0) {
    const { state: current, path } = queue.shift()!;
    for (const { group, next } of moves(level, current)) {
      const key = stateKey(level, next);
      if (seen.has(key)) {
        continue;
      }
      const nextPath = [...path, group];
      if (isWon(level, next)) {
        return nextPath;
      }
      seen.add(key);
      queue.push({ state: next, path: nextPath });
    }
  }
  return null;
}

function fastest(level: Level, state: GameState, elapsed: number): string[][] | null {
  const limit = level.timeLimit!;
  const best = new Map<string, number>([[stateKey(level, state), elapsed]]);
  // State spaces are tiny (at most a few hundred states), so a sorted array is a fine priority queue.
  const open: { state: GameState; time: number; path: string[][] }[] = [{ state, time: elapsed, path: [] }];
  while (open.length > 0) {
    open.sort((a, b) => a.time - b.time || a.path.length - b.path.length);
    const { state: current, time, path } = open.shift()!;
    if (time > (best.get(stateKey(level, current)) ?? Infinity)) {
      continue;
    }
    if (isWon(level, current)) {
      return path;
    }
    for (const { group, next } of moves(level, current)) {
      const nextTime = time + crossingTime(level, group);
      const key = stateKey(level, next);
      if (nextTime > limit || nextTime >= (best.get(key) ?? Infinity)) {
        continue;
      }
      best.set(key, nextTime);
      open.push({ state: next, time: nextTime, path: [...path, group] });
    }
  }
  return null;
}

/** Total minutes a sequence of crossings takes. */
export const pathTime = (level: Level, path: string[][]) =>
  path.reduce((sum, group) => sum + crossingTime(level, group), 0);

/**
 * The best achievable score: fewest crossings on untimed levels, fewest
 * minutes on timed ones. Players' results are compared against this.
 */
export function bestScore(level: Level): number {
  const path = solve(level, initialState(level)) ?? [];
  return level.timeLimit === undefined ? path.length : pathTime(level, path);
}
