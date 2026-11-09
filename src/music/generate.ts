import {
  analyze,
  buildRhythm,
  cantusTonic,
  cfPitch,
  LOWER_RANGE,
  UPPER_RANGE,
  type Context,
  type Exercise,
  type Species,
} from './exercise'
import { choice, seeded, shuffle, weightedOrder, type Rand } from './random'
import { validate } from './rules'
import { badLeapChain, degree, intervalBetween, melodicProblem, MODES, unrecoveredLeap } from './theory'

export type Level = 1 | 2 | 3 | 4 | 5

export interface Puzzle {
  key: string
  species: Species
  level: Level
  exercise: Exercise
  /** Notes shown to the player; null marks a blank to fill. */
  given: (number | null)[]
  /** One valid completion (there are usually many). */
  solution: number[]
}

const BARS: Record<Species, readonly number[]> = {
  1: [8, 9, 10, 11, 12],
  2: [8, 9, 9, 10, 11],
  3: [7, 8, 8, 9, 10],
  4: [8, 9, 9, 10, 11],
  5: [7, 8, 8, 9, 10],
}
const BLANK_SHARE = [0.25, 0.4, 0.55, 0.75, 1]

const nat = (step: number) => ({ step, alter: 0 })

/** A cantus firmus: starts and ends on the final, approached from the step above, mostly stepwise. */
export function generateCantus(rand: Rand, tonic: number, voice: [number, number], length: number): number[] | null {
  const lo = Math.max(voice[0], tonic - 3)
  const hi = Math.min(voice[1], tonic + 8)
  const cf = new Array<number>(length).fill(tonic)
  cf[length - 2] = tonic + 1
  const maxLeaps = Math.floor(length / 3)
  let nodes = 0

  const fits = (k: number): boolean => {
    const d = cf[k] - cf[k - 1]
    if (d === 0 || Math.abs(d) > 4 || melodicProblem(nat(cf[k - 1]), nat(cf[k]))) return false
    if (k >= 2) {
      if (unrecoveredLeap(cf[k - 1] - cf[k - 2], d)) return false
      if (badLeapChain(nat(cf[k - 2]), nat(cf[k - 1]), nat(cf[k]))) return false
    }
    const line = cf.slice(0, k + 1)
    if (Math.max(...line) - Math.min(...line) > 8) return false
    let leaps = 0
    for (let j = 1; j <= k; j++) if (Math.abs(cf[j] - cf[j - 1]) > 1) leaps++
    return leaps <= maxLeaps
  }

  const finished = (): boolean => {
    if (!fits(length - 2) || !fits(length - 1)) return false
    const top = Math.max(...cf)
    const range = top - Math.min(...cf)
    return cf.filter((s) => s === top).length === 1 && range >= 4 && cf.some((s, j) => j > 0 && Math.abs(s - cf[j - 1]) > 1)
  }

  const fill = (k: number): boolean => {
    if (++nodes > 4000) return false
    if (k === length - 2) return finished()
    const options = weightedOrder(rand, range(lo, hi), (s) => (Math.abs(s - cf[k - 1]) === 1 ? 3 : 1))
    for (const s of options) {
      cf[k] = s
      if (fits(k) && fill(k + 1)) return true
    }
    return false
  }
  return fill(1) ? cf : null
}

const MOTION_WEIGHT = [0.02, 1, 0.6, 0.35, 0.25, 0.08, 0.01, 0.08]

/** Backtracking search for a counterpoint that breaks no rule. */
export function solve(ctx: Context, rand: Rand, budget = 40 * ctx.slots.length): number[] | null {
  const n = ctx.slots.length
  // Filled left to right; later slots stay null so only rules about the written prefix apply.
  const steps: (number | null)[] = new Array(n).fill(null)
  const [lo, hi] = ctx.range
  const { mode, cpAbove, species } = ctx.ex
  const leapy = species === 1 ? 1.6 : 1
  let nodes = 0

  const candidates = (i: number): number[] => {
    let list = range(lo, hi)
    const cf = cfPitch(ctx, ctx.slots[i].bar)
    if (i === n - 1) list = list.filter((s) => intervalBetween(nat(s), cf).perfect === 'octave')
    else if (i === n - 2) list = list.filter((s) => degree(s, mode) === 6)
    else if (i === 0)
      list = list.filter((s) => {
        const iv = intervalBetween(nat(s), cf)
        return cpAbove ? iv.perfect !== null && s >= cf.step : iv.perfect === 'octave' && s <= cf.step
      })
    const ref = i > 0 ? steps[i - 1] : null
    if (ref == null) return shuffle(rand, list)
    return weightedOrder(rand, list, (s) => {
      const d = Math.abs(s - ref)
      return d > 1 ? (MOTION_WEIGHT[d] ?? 0.005) * leapy : MOTION_WEIGHT[d]
    })
  }

  const place = (i: number): boolean => {
    if (i === n) return true
    if (++nodes > budget) return false
    for (const s of candidates(i)) {
      steps[i] = s
      if (validate(ctx, steps).length === 0 && place(i + 1)) return true
    }
    steps[i] = null
    return false
  }
  return place(0) ? (steps as number[]) : null
}

export function makePuzzle(dateKey: string, species: Species, level: Level): Puzzle {
  const key = `${dateKey}/${species}/${level}`
  const rand = seeded(key)
  for (let attempt = 0; attempt < 500; attempt++) {
    const mode = choice(rand, MODES)
    const cpAbove = rand() < 0.6
    const bars = BARS[species][level - 1]
    const tonic = cantusTonic(mode, cpAbove)
    const cf = generateCantus(rand, tonic, cpAbove ? LOWER_RANGE : UPPER_RANGE, bars)
    if (!cf) continue
    const exercise: Exercise = { species, mode, cpAbove, cf, slots: buildRhythm(species, bars, rand) }
    const ctx = analyze(exercise)
    let solution: number[] | null = null
    // Successful searches finish almost immediately; a stuck one is cheaper to restart than to finish.
    for (let tries = 0; tries < 3 && !solution; tries++) solution = solve(ctx, rand)
    if (!solution) continue
    const n = solution.length
    const blanks = new Set(shuffle(rand, range(0, n - 1)).slice(0, Math.max(1, Math.round(n * BLANK_SHARE[level - 1]))))
    const given = solution.map((s, i) => (blanks.has(i) ? null : s))
    return { key, species, level, exercise, given, solution }
  }
  throw new Error(`Could not build puzzle ${key}`)
}

function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}
