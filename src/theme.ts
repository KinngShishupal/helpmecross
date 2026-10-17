export const colors = {
  text: '#1f2933',
  muted: '#5f6b76',
  white: '#ffffff',
  glass: 'rgba(14, 32, 64, 0.42)',
  glassBorder: 'rgba(255, 255, 255, 0.35)',
  primary: '#ff7a1a',
  primaryDark: '#c95300',
  gold: '#ffc83d',
  danger: '#e53935',
  success: '#2e9d4f',
  card: '#ffffff',
};

export const DIFFICULTY_COLORS = {
  Easy: '#2e9d4f',
  Medium: '#f59e0b',
  Hard: '#ea580c',
  Expert: '#b91c1c',
} as const;

export const textShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.45)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
};

/** Star rating for a finished level. */
export function starsFor(moves: number, optimal: number) {
  if (moves <= optimal) {
    return 3;
  }
  return moves <= optimal + 4 ? 2 : 1;
}
