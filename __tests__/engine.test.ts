import {
  bestScore,
  cross,
  crossingTime,
  departureError,
  findViolation,
  initialState,
  isWon,
  pathTime,
  solve,
  timeUp,
} from '../src/game/engine';
import { LEVELS } from '../src/game/levels';

const level = (id: string) => LEVELS.find(l => l.id === id)!;

test('there are 24 stages with unique ids', () => {
  expect(LEVELS).toHaveLength(24);
  expect(new Set(LEVELS.map(l => l.id)).size).toBe(24);
});

test.each(LEVELS.map(l => [l.id, l] as const))('%s is solvable and its solution replays cleanly', (_, lvl) => {
  const path = solve(lvl, initialState(lvl));
  expect(path).not.toBeNull();

  let state = initialState(lvl);
  for (const group of path!) {
    expect(departureError(lvl, group)).toBeNull();
    state = cross(state, group);
    expect(findViolation(lvl, state, group)).toBeNull();
  }
  expect(isWon(lvl, state)).toBe(true);
});

test.each([
  ['farmer', 7],
  ['missionaries', 11],
  ['couples', 11],
  ['family', 17],
])('%s needs %i crossings', (id, expected) => {
  const lvl = level(id);
  expect(solve(lvl, initialState(lvl))!.length).toBe(expected);
});

test('farmer leaving wolf with goat is a violation', () => {
  const lvl = level('farmer');
  const next = cross(initialState(lvl), ['farmer', 'cabbage']);
  expect(findViolation(lvl, next, ['farmer', 'cabbage'])).toMatch(/wolf ate/);
});

test('only rowers can take the boat', () => {
  const lvl = level('family');
  expect(departureError(lvl, ['son1', 'thief'])).toMatch(/row/);
  expect(departureError(lvl, ['police', 'thief'])).toBeNull();
});

test('weight limits are enforced', () => {
  const lvl = level('soldiers-2');
  expect(departureError(lvl, ['soldier1', 'boy1'])).toMatch(/Too heavy/);
  expect(departureError(lvl, ['boy1', 'boy2'])).toBeNull();
});

test.each(LEVELS.filter(l => l.timeLimit !== undefined).map(l => [l.id, l] as const))(
  '%s: the time limit is exactly the best possible time',
  (_, lvl) => {
    expect(bestScore(lvl)).toBe(lvl.timeLimit);
  },
);

test('the classic bridge takes 17 minutes, with the fastest pair ferrying the torch', () => {
  const lvl = level('bridge');
  const path = solve(lvl, initialState(lvl))!;
  expect(pathTime(lvl, path)).toBe(17);
  expect(crossingTime(lvl, ['son', 'grandpa'])).toBe(10);
});

test('running over the time limit loses', () => {
  const lvl = level('bridge');
  expect(timeUp(lvl, 17)).toBeNull();
  expect(timeUp(lvl, 18)).toMatch(/Out of time/);
  // escorting everyone with the fastest walker is too slow
  const slow = [['son', 'grandpa'], ['son'], ['son', 'father'], ['son'], ['son', 'daughter']];
  expect(pathTime(lvl, slow)).toBe(19);
});

test('hints account for minutes already used', () => {
  const lvl = level('bridge');
  const afterSlowStart = cross(initialState(lvl), ['son', 'grandpa']);
  // 10 minutes gone: the remaining crossings cannot fit in 7 more minutes
  expect(solve(lvl, afterSlowStart, 10)).toBeNull();
});

test('on the bridge, someone must carry the torch', () => {
  const lvl = level('bridge-kids');
  expect(departureError(lvl, ['son', 'daughter'])).toMatch(/torch/);
  expect(departureError(lvl, ['son', 'mother'])).toBeNull();
});
