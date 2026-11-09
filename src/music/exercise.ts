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
      case 5:
        floridBar(slots, b, last, rand, push)
        break
    }
  }
  slots.push({ start: last * BAR, dur: 8 })
  return slots
}

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

function floridBar(
  slots: Slot[],
  b: number,
  last: number,
  rand: Rand,
  push: (bar: number, offset: number, durs: number[]) => void,
) {
  const prev = slots[slots.length - 1]
  const tiedIn = prev !== undefined && prev.start + prev.dur > b * BAR
  // The cadence is always a 7–6 (or 2–3) suspension resolving to the leading tone.
  if (b === last - 1) return push(b, 4, [4])
  const mustTieOut = b === last - 2
  let durs: number[]
  if (b === 0) durs = mustTieOut ? [4] : pick(rand, [[[4], 1], [[2, 2], 1]] as const)
  else if (tiedIn) durs = mustTieOut ? [4] : pick(rand, TIED_IN_BARS)
  else {
    const options = mustTieOut ? FREE_BARS.filter(([d]) => d[d.length - 1] === 4) : FREE_BARS
    durs = pick(rand, options)
  }
  push(b, b === 0 || tiedIn ? 4 : 0, durs)
  const tail = slots[slots.length - 1]
  if (tail.dur === 4 && tail.start % BAR === 4 && (mustTieOut || rand() < 0.45)) tail.dur = 8
}
