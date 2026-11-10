import type { Violation } from './music/rules'

/** How a written note fared at the last check. */
export type Mark = 'ok' | 'melodic' | 'harmonic'

export interface Attempt {
  /** Worst mark per bar that held a blank, for the share grid. */
  bars: Mark[]
  violations: Violation[]
  /** No correct answer keeps every note this check marked green. */
  deadEnd?: boolean
}

export interface GameState {
  notes: (number | null)[]
  /** Feedback shown on each note until it is changed. */
  marks: (Mark | null)[]
  attempts: Attempt[]
  status: 'playing' | 'won' | 'lost'
}

const gameKey = (puzzleKey: string) => `cptl:v3:game:${puzzleKey}`

export function loadGame(puzzleKey: string): GameState | null {
  try {
    const raw = localStorage.getItem(gameKey(puzzleKey))
    return raw ? (JSON.parse(raw) as GameState) : null
  } catch {
    return null
  }
}

export function saveGame(puzzleKey: string, state: GameState) {
  try {
    localStorage.setItem(gameKey(puzzleKey), JSON.stringify(state))
  } catch {
    /* progress just won't survive a reload */
  }
}

export function loadSetting<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`cptl:setting:${name}`)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function saveSetting(name: string, value: unknown) {
  try {
    localStorage.setItem(`cptl:setting:${name}`, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
