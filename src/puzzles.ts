import type { Exercise, Species } from './music/exercise'
import { puzzleKey, type Level, type Puzzle, type Variant } from './music/generate'
import { SPECIES_IN, type Rulebook } from './music/rules'
import type { WorkerRequest } from './worker'

export const LEVELS: readonly Level[] = [1, 2, 3]
export const speciesFor = (variant: Variant): readonly Species[] => SPECIES_IN[variant.rules]
export const MAX_CHECKS = 6

/** The site at /ap plays by the AP rulebook; everywhere else is Fux. */
export const SITE_RULES: Rulebook = /^\/ap\/?$/.test(location.pathname) ? 'ap' : 'fux'
/** Where this version of the game lives, for share links. */
export const siteUrl = () => location.origin + (SITE_RULES === 'ap' ? '/ap' : '')

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

export { puzzleKey }

// Two workers: one answers whatever the player opens, the other quietly composes the rest of the day.
const workers = { now: spawn(), later: spawn() }
const pending = new Map<number, (result: unknown) => void>()
const cache = new Map<string, Promise<Puzzle>>()
let nextId = 0

function spawn(): Worker {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<{ id: number; result: unknown }>) => {
    pending.get(e.data.id)?.(e.data.result)
    pending.delete(e.data.id)
  }
  return w
}

function ask<T>(worker: Worker, req: WorkerRequest): Promise<T> {
  return new Promise((resolve) => {
    const id = nextId++
    pending.set(id, resolve as (result: unknown) => void)
    worker.postMessage({ id, req })
  })
}

function stored(key: string): Puzzle | null {
  try {
    const raw = localStorage.getItem(`cptl:v3:puzzle:${key}`)
    return raw ? (JSON.parse(raw) as Puzzle) : null
  } catch {
    return null
  }
}

export function loadPuzzle(day: string, species: Species, level: Level, variant: Variant, urgent = true): Promise<Puzzle> {
  const key = puzzleKey(day, species, level, variant)
  const hit = cache.get(key)
  if (hit) return hit
  const saved = stored(key)
  const promise = saved
    ? Promise.resolve(saved)
    : ask<Puzzle>(urgent ? workers.now : workers.later, { kind: 'puzzle', day, species, level, variant }).then((p) => {
        try {
          localStorage.setItem(`cptl:v3:puzzle:${key}`, JSON.stringify(p))
        } catch {
          /* storage full or blocked: the puzzle still works for this visit */
        }
        return p
      })
  cache.set(key, promise)
  return promise
}

/** Whether some answer keeps every note in `fixed`; null when the search gave up first. */
export const canComplete = (exercise: Exercise, fixed: (number | null)[]) =>
  ask<boolean | null>(workers.now, { kind: 'completable', exercise, fixed })

export function prefetchDay(day: string, variant: Variant) {
  for (const s of speciesFor(variant)) for (const l of LEVELS) void loadPuzzle(day, s, l, variant, false)
}
