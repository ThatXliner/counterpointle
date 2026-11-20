import type { Rulebook } from './rules'
import { degree, finalStep, keyAlter, letterOf, raisesLeadingTone, type Key, type Pitch } from './theory'

export type Species = 1 | 2 | 3 | 4 | 5

/** Time is counted in eighth notes; every bar is a whole note. */
export const BAR = 8

/** One note of the counterpoint. A note may run over the barline, which is drawn as a tie. */
export interface Slot {
  start: number
  dur: number
}

export interface Exercise {
  species: Species
  rules: Rulebook
  key: Key
  /** Counterpoint above the cantus firmus, or below it. */
  cpAbove: boolean
  /** Cantus firmus as diatonic steps, one whole note per bar. */
  cf: number[]
  slots: Slot[]
}

export interface SlotInfo extends Slot {
  bar: number
  /** Position within the bar, 0 = downbeat. */
  offset: number
  /** Sustained across the next barline (a syncopation / suspension). */
  tiesOver: boolean
}

/** A moment where at least one voice attacks a note. */
export interface Moment {
  time: number
  bar: number
  /** Counterpoint note sounding, or -1 during the opening rest. */
  slot: number
  cfAttack: boolean
  cpAttack: boolean
}

export interface Context {
  ex: Exercise
  bars: number
  slots: SlotInfo[]
  moments: Moment[]
  /** Index into `moments` of each bar's downbeat. */
  downbeats: number[]
  /** Lowest and highest step the counterpoint may use. */
  range: [number, number]
}

/** Voice ranges in diatonic steps: treble G3–A5 and bass E2–E4. */
export const UPPER_RANGE: [number, number] = [25, 40]
export const LOWER_RANGE: [number, number] = [16, 30]

export function cantusTonic(key: Key, cpAbove: boolean): number {
  const t = finalStep(key, cpAbove ? 3 : 4)
  // A low cantus on G, A or B sits an octave down so the counterpoint has room above it.
  return cpAbove && t > 24 ? t - 7 : t
}

/** A step as the key signature spells it. */
export function pitchIn(key: Key, step: number): Pitch {
  return { step, alter: keyAlter(letterOf(step), key.sig) }
}

export function analyze(ex: Exercise): Context {
  const bars = ex.cf.length
  const slots: SlotInfo[] = ex.slots.map((s) => {
    const bar = Math.floor(s.start / BAR)
    const offset = s.start % BAR
    return { ...s, bar, offset, tiesOver: offset + s.dur > BAR }
  })
  const times = new Set<number>()
  for (let b = 0; b < bars; b++) times.add(b * BAR)
  for (const s of slots) times.add(s.start)
  const moments: Moment[] = []
  const downbeats: number[] = []
  let k = 0
  for (const time of [...times].sort((a, b) => a - b)) {
    while (k < slots.length - 1 && slots[k].start + slots[k].dur <= time) k++
    const covering = slots[k].start <= time && time < slots[k].start + slots[k].dur
    const bar = Math.floor(time / BAR)
    if (time % BAR === 0) downbeats.push(moments.length)
    moments.push({
      time,
      bar,
      slot: covering ? k : -1,
      cfAttack: time % BAR === 0,
      cpAttack: covering && slots[k].start === time,
    })
  }
  return { ex, bars, slots, moments, downbeats, range: ex.cpAbove ? UPPER_RANGE : LOWER_RANGE }
}

/** Sounding pitch of a counterpoint note: sevenths begun in the penultimate bar are raised (musica ficta). */
export function cpPitch(ctx: Context, i: number, step: number): Pitch {
  const { key } = ctx.ex
  const raised = ctx.slots[i].bar === ctx.bars - 2 && degree(step, key) === 6 && raisesLeadingTone(key.mode)
  const p = pitchIn(key, step)
  return raised ? { step, alter: p.alter + 1 } : p
}

export function cfPitch(ctx: Context, bar: number): Pitch {
  return pitchIn(ctx.ex.key, ctx.ex.cf[bar])
}

type Rand = () => number

function pick<T>(rand: Rand, options: readonly (readonly [T, number])[]): T {
  const total = options.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [value, w] of options) {
    r -= w
    if (r <= 0) return value
  }
  return options[options.length - 1][0]
}

/** Rhythm of the counterpoint for a given species and number of bars. */
export function buildRhythm(species: Species, bars: number, rand: Rand): Slot[] {
  if (species === 5) return floridSlots(randomFlorid(bars, rand))
  const slots: Slot[] = []
  const last = bars - 1
  const push = (bar: number, offset: number, durs: number[]) => {
    let t = bar * BAR + offset
    for (const dur of durs) {
      slots.push({ start: t, dur })
      t += dur
    }
  }
  for (let b = 0; b < last; b++) {
    switch (species) {
      case 1:
        push(b, 0, [8])
        break
      case 2:
        push(b, b === 0 ? 4 : 0, b === 0 ? [4] : [4, 4])
        break
      case 3:
        push(b, 0, [2, 2, 2, 2])
        break
      case 4:
        push(b, 4, [b === last - 1 ? 4 : 8])
        break
    }
  }
  slots.push({ start: last * BAR, dur: 8 })
  return slots
}

/** One bar of a florid line: its note values, and whether its last note is tied into the next bar. */
export interface FloridBar {
  durs: readonly number[]
  tie: boolean
}

const OPENING_BARS: readonly (readonly [number[], number])[] = [
  [[4], 1],
  [[2, 2], 1],
]
const FREE_BARS: readonly (readonly [number[], number])[] = [
  [[4, 4], 3],
  [[4, 2, 2], 3],
  [[2, 2, 4], 3],
  [[2, 2, 2, 2], 3],
  [[2, 1, 1, 2, 2], 1.5],
  [[2, 2, 2, 1, 1], 1.5],
]
const TIED_IN_BARS: readonly (readonly [number[], number])[] = [
  [[4], 2],
  [[2, 2], 3],
  [[2, 1, 1], 1],
]

/**
 * The rhythms bar `b` of a florid line may take, with their weights. The opening bar and a bar a tie runs into
 * start on the weak half. The cadence is always a 7–6 (or 2–3) suspension resolving to the leading tone.
 */
export function floridOptions(b: number, last: number, tiedIn: boolean): readonly (readonly [number[], number])[] {
  if (b === last - 1) return [[[4], 1]]
  const options = b === 0 ? OPENING_BARS : tiedIn ? TIED_IN_BARS : FREE_BARS
  return b === last - 2 ? options.filter(([d]) => d[d.length - 1] === 4) : options
}

/** Whether a bar's last note may be tied over, or must be: only a half note on the weak half can. */
export function floridTie(b: number, last: number, durs: readonly number[]): 'never' | 'may' | 'must' {
  if (b === last - 1 || durs[durs.length - 1] !== 4) return 'never'
  return b === last - 2 ? 'must' : 'may'
}

function randomFlorid(bars: number, rand: Rand): FloridBar[] {
  const last = bars - 1
  const out: FloridBar[] = []
  for (let b = 0; b < last; b++) {
    const options = floridOptions(b, last, out[b - 1]?.tie ?? false)
    const durs = options.length > 1 ? pick(rand, options) : options[0][0]
    const tie = floridTie(b, last, durs)
    out.push({ durs, tie: tie === 'must' || (tie === 'may' && rand() < 0.45) })
  }
  return out
}

/** Slots of a florid line from the rhythm of every bar but the final whole note. */
export function floridSlots(rhythm: readonly FloridBar[]): Slot[] {
  const slots: Slot[] = []
  rhythm.forEach(({ durs, tie }, b) => {
    let t = b * BAR + (b === 0 || rhythm[b - 1].tie ? 4 : 0)
    for (const dur of durs) {
      slots.push({ start: t, dur })
      t += dur
    }
    if (tie) slots[slots.length - 1].dur = 8
  })
  slots.push({ start: rhythm.length * BAR, dur: 8 })
  return slots
}
