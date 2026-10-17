/**
 * Help Me Cross
 *
 * @format
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initAds } from './src/ads';
import { LEVELS } from './src/game/levels';
import { Level } from './src/game/types';
import GameScreen from './src/screens/GameScreen';
import HomeScreen from './src/screens/HomeScreen';
import LandingScreen from './src/screens/LandingScreen';
import { SettingsProvider } from './src/settings';
import { loadProgress, Progress, saveProgress } from './src/storage';

/** Landing page → stage list → a stage. */
type Screen = { name: 'landing' } | { name: 'stages' } | { name: 'game'; level: Level };

/** The stage after this one, if any. */
const nextLevel = (level: Level) => LEVELS[LEVELS.findIndex(l => l.id === level.id) + 1];

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'landing' });
  const [bestMoves, setBestMoves] = useState<Progress>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    initAds();
    loadProgress().then(progress => {
      setBestMoves(progress);
      setLoaded(true);
    });
  }, []);

  // persist progress whenever it changes (once the saved copy has been read)
  useEffect(() => {
    if (loaded) {
      saveProgress(bestMoves);
    }
  }, [bestMoves, loaded]);

  const showLanding = useCallback(() => setScreen({ name: 'landing' }), []);
  const showStages = useCallback(() => setScreen({ name: 'stages' }), []);
  const playLevel = useCallback((level: Level) => setScreen({ name: 'game', level }), []);
  const handleWin = useCallback((levelId: string, moves: number) => {
    setBestMoves(prev => ({
      ...prev,
      [levelId]: Math.min(prev[levelId] ?? Infinity, moves),
    }));
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <StatusBar hidden />
        {screen.name === 'landing' && <LandingScreen onPlay={showStages} />}
        {screen.name === 'stages' && <HomeScreen bestMoves={bestMoves} onSelect={playLevel} onBack={showLanding} />}
        {screen.name === 'game' && (
          <GameScreen
            key={screen.level.id}
            level={screen.level}
            onExit={showStages}
            onWin={handleWin}
            onNext={nextLevel(screen.level) ? () => playLevel(nextLevel(screen.level)!) : undefined}
          />
        )}
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

export default App;
