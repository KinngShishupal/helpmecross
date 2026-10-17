import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { audio } from './audio';

interface Settings {
  sound: boolean;
  music: boolean;
  toggleSound: () => void;
  toggleMusic: () => void;
}

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);

  useEffect(() => {
    audio.init();
  }, []);
  useEffect(() => audio.setSound(sound), [sound]);
  useEffect(() => audio.setMusic(music), [music]);

  const value = useMemo(
    () => ({
      sound,
      music,
      toggleSound: () => setSound(s => !s),
      toggleMusic: () => setMusic(m => !m),
    }),
    [sound, music],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return ctx;
}
