import { describe, expect, it } from 'vitest'
import { analyze, buildRhythm, cpPitch, type Exercise, type Species } from './exercise'
import { makePuzzle, type Level } from './generate'
import { validate } from './rules'
import { C_MAJOR, keyName } from './theory'

const C3 = 21
const cf = [0, 2, 1, 3, 2, 1, 0].map((d) => C3 + d) // C E D F E D C

function exercise(species: Species, cantus: number[], above: boolean): Exercise {
  return { species, key: C_MAJOR, cpAbove: above, cf: cantus, slots: buildRhythm(species, cantus.length, Math.random) }
}
const check = (species: Species, cp: (number | null)[], above = true, cantus = cf) =>
  validate(analyze(exercise(species, cantus, above)), cp)
const rules = (vs: { rule: string }[]) => vs.map((v) => v.rule)

describe('first species (AP rules)', () => {
  it('accepts a good counterpoint', () => {
    // CF:  C3  E3  D3  F3  E3  D3  C3
    // CP:  G3  C4  D4  A3  C4  B3  C4   → 5 6 8 3 6 6 8
    expect(check(1, [25, 28, 29, 26, 28, 27, 28])).toEqual([])
  })

  it('flags parallel fifths', () => {
    // C3/G3 then E3/B3
    expect(rules(check(1, [25, 27, 26, 26, 28, 27, 28]))).toContain('parallels')
  })

  it('flags a dissonance', () => {
    // D4 over E3 is a seventh
    expect(rules(check(1, [25, 29, 27, 26, 28, 27, 28]))).toContain('dissonance')
  })

  it('flags hidden octaves when the upper voice leaps', () => {
    // CF D3→F3 rises a third while the CP leaps A3→F4 into the octave
    expect(rules(check(1, [25, 28, 26, 31, 28, 27, 28]))).toContain('hidden')
  })

  it('allows hidden fifths when the upper voice steps', () => {
    // CF E3→D3 falls a step, CP B3→A3 falls a step into the fifth
    const vs = check(1, [28, 27, 26, 28, 28, 27, 28], true, [21, 23, 22, 24, 23, 22, 21])
    expect(rules(vs)).not.toContain('hidden')
  })

  it('makes the leading tone rise to the tonic', () => {
    // B3 over E3, then A3: the leading tone falls
    expect(rules(check(1, [25, 27, 26, 26, 28, 27, 28]))).toContain('leading-tone')
  })

  it('allows a repeated note on the beat', () => {
    expect(rules(check(1, [25, 25, 29, 26, 28, 27, 28]))).not.toContain('repeat')
  })

  it('keeps upper voices to leaps of a fifth', () => {
    // G3 up to E4 is a sixth
    expect(rules(check(1, [25, 30, 29, 26, 28, 27, 28]))).toContain('interval')
  })

  it('lets the bass leap an octave if it turns back', () => {
    const upper = [28, 30, 29, 31, 30, 29, 28] // C4 E4 D4 F4 E4 D4 C4
    // A2 up an octave to A3, then down to G3 (fine) or on up to B3 (not)
    expect(rules(check(1, [null, 19, 26, 25, null, null, null], false, upper))).not.toContain('leap')
    expect(rules(check(1, [null, 19, 26, 27, null, null, null], false, upper))).toContain('leap')
  })

  it('requires the leading tone at the cadence', () => {
    expect(rules(check(1, [25, 28, 27, 26, 28, 25, 28]))).toContain('cadence')
  })

  it('judges only what is written', () => {
    expect(check(1, [25, null, null, null, null, null, null])).toEqual([])
  })
})

describe('second species (AP rules)', () => {
  // The half-note line starts after a half rest: slot 0 is in bar 1, then two per bar.
  it('accepts a neighbor tone on the weak beat', () => {
    // over E3: C4 (6) → D4 (7, upper neighbor) → C4 over C3 (8)
    const cp = [25, 28, 29, 28, null, null, null, null, null, null, null, null, null]
    expect(rules(check(2, cp, true, [21, 23, 21, 24, 23, 22, 21]))).not.toContain('dissonance')
  })

  it('forbids repeating a note from the weak beat', () => {
    // G3 (upbeat of bar 1) → G3 (downbeat of bar 2)
    const cp = [25, 25, null, null, null, null, null, null, null, null, null, null, null]
    expect(rules(check(2, cp))).toContain('repeat')
  })

  it('flags unequal fifths', () => {
    // Below C4 E4 D4 F4 …: B3 under F4 (d5) on the weak beat, then A3 under E4 (P5)
    const cp = [null, null, null, null, null, null, 27, 26, null, null, null, null, null]
    const vs = check(2, cp, false, [28, 30, 29, 31, 30, 29, 28])
    expect(rules(vs)).toContain('unequal-fifths')
  })
})

describe('keys', () => {
  it('spells notes from the key signature and raises the leading tone', () => {
    const p = makePuzzle('2026-11-09', 1, 1, true)
    const ctx = analyze(p.exercise)
    expect(keyName(p.exercise.key)).toMatch(/^[A-G][♯♭]? (major|minor|Dorian|Mixolydian)$/)
    const penultimate = cpPitch(ctx, p.solution.length - 2, p.solution[p.solution.length - 2])
    expect(penultimate.step).toBe(p.solution[p.solution.length - 1] - 1)
  })
})

describe('generated puzzles', () => {
  const days = ['2026-11-09', '2026-12-25', '2027-03-14']
  for (const hard of [false, true]) {
    for (const species of [1, 2, 3, 4, 5] as Species[]) {
      it(`species ${species}${hard ? ' (hard)' : ''}: solutions are valid and given notes come from them`, () => {
        for (const day of days) {
          for (const level of [1, 2, 3, 4, 5] as Level[]) {
            const p = makePuzzle(day, species, level, hard)
            if (!hard) expect(p.exercise.key).toEqual(C_MAJOR)
            expect(validate(analyze(p.exercise), p.solution)).toEqual([])
            p.given.forEach((g, i) => g !== null && expect(g).toBe(p.solution[i]))
            expect(p.given.some((g) => g === null)).toBe(true)
          }
        }
      })
    }
  }

  it('is the same puzzle for everyone on the same day', () => {
    expect(makePuzzle('2026-11-09', 3, 2)).toEqual(makePuzzle('2026-11-09', 3, 2))
  })
})
