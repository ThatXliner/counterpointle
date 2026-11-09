export type Mode = 'ionian' | 'dorian' | 'mixolydian' | 'aeolian'

export const MODES: readonly Mode[] = ['ionian', 'dorian', 'mixolydian', 'aeolian']

/** Letter index (C = 0 … B = 6) of each mode's final with no key signature. */
const FINAL_LETTER: Record<Mode, number> = { ionian: 0, dorian: 1, mixolydian: 4, aeolian: 5 }

const MODE_LABEL: Record<Mode, string> = { ionian: 'major', dorian: 'Dorian', mixolydian: 'Mixolydian', aeolian: 'minor' }

/** A mode transposed by a key signature: `sig` counts sharps (positive) or flats (negative). */
export interface Key {
  mode: Mode
  sig: number
}

export const C_MAJOR: Key = { mode: 'ionian', sig: 0 }

const LETTER_NAMES = 'CDEFGAB'
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6] // F C G D A E B
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3] // B E A D G C F
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

/** A pitch as a diatonic step (one per letter name, C4 = 28) plus a chromatic alteration. */
export interface Pitch {
  step: number
  alter: number
}

export const mod = (n: number, m: number) => ((n % m) + m) % m
export const letterOf = (step: number) => mod(step, 7)
export const octaveOf = (step: number) => Math.floor(step / 7)

export function midi({ step, alter }: Pitch): number {
  return 12 * (octaveOf(step) + 1) + LETTER_SEMITONES[letterOf(step)] + alter
}

export function pitchName(p: Pitch): string {
  const accidental = p.alter > 0 ? '♯' : p.alter < 0 ? '♭' : ''
  return `${LETTER_NAMES[letterOf(p.step)]}${accidental}${octaveOf(p.step)}`
}

/** The alteration the key signature gives a letter. */
export function keyAlter(letter: number, sig: number): number {
  if (sig > 0) return SHARP_ORDER.indexOf(letter) < sig ? 1 : 0
  if (sig < 0) return FLAT_ORDER.indexOf(letter) < -sig ? -1 : 0
  return 0
}

/** Each sharp moves the major key up a fifth (four steps); each flat down one. */
const finalLetter = (key: Key) => mod(4 * key.sig + FINAL_LETTER[key.mode], 7)

/** Scale degree within the mode: 0 is the final, 6 the seventh. */
export function degree(step: number, key: Key): number {
  return mod(step - finalLetter(key), 7)
}

export function finalStep(key: Key, octave: number): number {
  return octave * 7 + finalLetter(key)
}

export function keyName(key: Key): string {
  const letter = finalLetter(key)
  return `${pitchName({ step: letter, alter: keyAlter(letter, key.sig) }).slice(0, -1)} ${MODE_LABEL[key.mode]}`
}

/** A note a half step below the final, which wants to rise to it. */
export function isLeadingTone(p: Pitch, key: Key): boolean {
  const final = finalLetter(key)
  return mod(midi(p) - midi({ step: final, alter: keyAlter(final, key.sig) }), 12) === 11
}

/** Every mode but Ionian has a whole step below the final, so its cadence needs a raised seventh. */
export function raisesLeadingTone(mode: Mode): boolean {
  return mode !== 'ionian'
}

export type Consonance = 'perfect' | 'imperfect' | 'dissonant'

export interface Interval {
  /** Diatonic distance, always ≥ 0: 0 is a unison, 7 an octave. */
  size: number
  semitones: number
  /** `size` folded into one octave (0–6). */
  simple: number
  consonance: Consonance
  /** 'octave' covers unisons and octaves; 'fifth' covers fifths and twelfths. */
  perfect: 'octave' | 'fifth' | null
}

export function intervalBetween(a: Pitch, b: Pitch): Interval {
  const aFirst = a.step < b.step || (a.step === b.step && midi(a) <= midi(b))
  const [lo, hi] = aFirst ? [a, b] : [b, a]
  const size = hi.step - lo.step
  const semitones = midi(hi) - midi(lo)
  const simple = size % 7
  const pc = mod(semitones, 12)
  if (simple === 0 && pc === 0) return { size, semitones, simple, consonance: 'perfect', perfect: 'octave' }
  if (simple === 4 && pc === 7) return { size, semitones, simple, consonance: 'perfect', perfect: 'fifth' }
  const imperfect = (simple === 2 && (pc === 3 || pc === 4)) || (simple === 5 && (pc === 8 || pc === 9))
  return { size, semitones, simple, consonance: imperfect ? 'imperfect' : 'dissonant', perfect: null }
}

const ORDINALS = ['unison', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'octave']

export function intervalName(size: number): string {
  return ORDINALS[size] ?? `${size + 1}th`
}

/**
 * What is wrong with a melodic move in strict style, or null if it is singable.
 * Allowed: seconds, thirds, perfect fourths and fifths, the ascending minor sixth, the octave.
 */
export function melodicProblem(a: Pitch, b: Pitch): string | null {
  const { size, semitones } = intervalBetween(a, b)
  const up = b.step > a.step
  switch (size) {
    case 0:
      return semitones === 0 ? null : 'a chromatic half step'
    case 1:
      return semitones <= 2 ? null : 'an augmented second'
    case 2:
      return semitones === 3 || semitones === 4 ? null : 'a diminished third'
    case 3:
      return semitones === 5 ? null : semitones === 6 ? 'a tritone' : 'a diminished fourth'
    case 4:
      return semitones === 7 ? null : semitones === 6 ? 'a tritone' : 'an augmented fifth'
    case 5:
      if (semitones === 8) return up ? null : 'a descending sixth'
      return 'a major sixth'
    case 6:
      return 'a seventh'
    case 7:
      return semitones === 12 ? null : 'a diminished octave'
    default:
      return 'more than an octave'
  }
}

/**
 * The AP Music Theory melodic rules (CED PIT-4.A.3 and PIT-3.D.2). Upper voices move by seconds, thirds,
 * perfect fourths and fifths. A bass may also leap a sixth or an octave, or fall a diminished fifth.
 */
export function apMelodicProblem(a: Pitch, b: Pitch, bass: boolean): string | null {
  const { size, semitones } = intervalBetween(a, b)
  if (size > 7) return 'more than an octave'
  if (size === 6) return 'a seventh'
  if (size === 4 && semitones === 6) return bass && b.step < a.step ? null : 'a diminished fifth'
  if (size === 3 && semitones === 6) return 'a tritone'
  const allowed = [[0], [1, 2], [3, 4], [5], [7], [8, 9], [], [12]][size]
  if (!allowed.includes(semitones)) return size === 0 ? 'a chromatic half step' : `an augmented or diminished ${intervalName(size)}`
  if (size <= 4 || bass) return null
  return `${size === 7 ? 'an octave' : 'a sixth'} (upper voices leap at most a fifth)`
}

/** Whether every pitch belongs to one major or minor triad. */
export function inOneTriad(pitches: Pitch[]): boolean {
  const classes = new Set(pitches.map((p) => mod(midi(p), 12)))
  return pitches.some((root) => {
    const r = mod(midi(root), 12)
    return [3, 4].some((third) => [...classes].every((c) => [0, third, 7].includes(mod(c - r, 12))))
  })
}

/** Leaps of a fifth or more must be followed by motion the other way. */
export function unrecoveredLeap(d1: number, d2: number): boolean {
  return Math.abs(d1) >= 4 && (d2 === 0 || Math.sign(d2) === Math.sign(d1))
}

/** Two leaps in one direction must outline a consonant chord no wider than an octave. */
export function badLeapChain(a: Pitch, b: Pitch, c: Pitch): boolean {
  const d1 = b.step - a.step
  const d2 = c.step - b.step
  if (Math.abs(d1) < 2 || Math.abs(d2) < 2 || Math.sign(d1) !== Math.sign(d2)) return false
  const outline = intervalBetween(a, c)
  return outline.size > 7 || outline.consonance === 'dissonant'
}
