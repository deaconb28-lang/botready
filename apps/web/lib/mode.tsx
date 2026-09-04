'use client';

/**
 * The Plain ⇄ Technical switch.
 *
 * One `mode` in app state, persisted to localStorage, read by every page that
 * carries two registers. It is not a translation layer: the two registers say
 * different things to different readers, a solo founder and an engineer, and
 * the copy lives in two parallel dictionaries rather than being derived.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Mode = 'plain' | 'tech';

const STORAGE_KEY = 'botready.mode';

interface ModeState {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggle: () => void;
}

const ModeContext = createContext<ModeState>({
  mode: 'plain',
  setMode: () => {},
  toggle: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('plain');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'plain' || stored === 'tech') setModeState(stored);
    } catch {
      /* private mode, or storage blocked: plain it is */
    }
  }, []);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* not persisted, still applied */
    }
  }, []);

  const toggle = useCallback(() => setMode(mode === 'plain' ? 'tech' : 'plain'), [mode, setMode]);

  return <ModeContext.Provider value={{ mode, setMode, toggle }}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeState {
  return useContext(ModeContext);
}

/** Pick the register's value. */
export function useCopy<T>(plain: T, tech: T): T {
  const { mode } = useMode();
  return mode === 'tech' ? tech : plain;
}
