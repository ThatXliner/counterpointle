import type { Species } from './music/exercise'
import type { Level, Puzzle } from './music/generate'
import type { PuzzleRequest } from './worker'

export const SPECIES: readonly Species[] = [1, 2, 3, 4, 5]
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5]
export const MAX_CHECKS = 6

const LAUNCH = Date.UTC(2026, 10, 9)

function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's puzzle date, overridable with ?d=YYYY-MM-DD to replay a past day. */
export function currentDay(): string {
  const override = new URLSearchParams(location.search).get('d')
  return override && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : localDay(new Date())
}

export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - LAUNCH) / 86400000) + 1
}

export const puzzleKey = (day: string, species: Species, level: Level) => `${day}/${species}/${level}`

// Two workers: one answers whatever the player opens, the other quietly composes the rest of the day.
const workers = { now: spawn(), later: spawn() }
const pending = new Map<number, (p: Puzzle) => void>()
const cache = new Map<string, Promise<Puzzle>>()
let nextId = 0

function spawn(): Worker {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<{ id: number; puzzle: Puzzle }>) => {
    pending.get(e.data.id)?.(e.data.puzzle)
    pending.delete(e.data.id)
  }
  return w
}

function stored(key: string): Puzzle | null {
  try {
    const raw = localStorage.getItem(`cptl:puzzle:${key}`)
    return raw ? (JSON.parse(raw) as Puzzle) : null
  } catch {
    return null
  }
}

export function loadPuzzle(day: string, species: Species, level: Level, urgent = true): Promise<Puzzle> {
  const key = puzzleKey(day, species, level)
  const hit = cache.get(key)
  if (hit) return hit
  const saved = stored(key)
  const promise = saved
    ? Promise.resolve(saved)
    : new Promise<Puzzle>((resolve) => {
        const id = nextId++
        pending.set(id, (p) => {
          try {
            localStorage.setItem(`cptl:puzzle:${key}`, JSON.stringify(p))
          } catch {
            /* storage full or blocked: the puzzle still works for this visit */
          }
          resolve(p)
        })
        const req: PuzzleRequest = { id, day, species, level }
        ;(urgent ? workers.now : workers.later).postMessage(req)
      })
  cache.set(key, promise)
  return promise
}

export function prefetchDay(day: string) {
  for (const s of SPECIES) for (const l of LEVELS) void loadPuzzle(day, s, l, false)
}
