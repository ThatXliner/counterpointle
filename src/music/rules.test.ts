import { describe, expect, it } from 'vitest'
import { analyze, buildRhythm, type Exercise, type Species } from './exercise'
import { makePuzzle, type Level } from './generate'
import { validate } from './rules'

const C3 = 21
const cf = [0, 2, 1, 3, 2, 1, 0].map((d) => C3 + d) // C E D F E D C

function first(cp: number[], above = true) {
  const ex: Exercise = { species: 1, mode: 'ionian', cpAbove: above, cf, slots: buildRhythm(1, cf.length, Math.random) }
  return validate(analyze(ex), cp)
}
const rules = (vs: { rule: string }[]) => vs.map((v) => v.rule)

describe('first species', () => {
  it('accepts a textbook counterpoint', () => {
    // CF:  C3  E3  D3  F3  E3  D3  C3
    // CP:  G3  C4  B3  A3  C4  B3  C4   → 5 6 6 3 6 6 8
    expect(first([25, 28, 27, 26, 28, 27, 28])).toEqual([])
  })

  it('flags parallel fifths', () => {
    // C3/G3 then E3/B3
    expect(rules(first([25, 27, 26, 26, 28, 27, 28]))).toContain('parallels')
  })

  it('flags a dissonance', () => {
    // D4 over E3 is a seventh
    expect(rules(first([25, 29, 27, 26, 28, 27, 28]))).toContain('dissonance')
  })

  it('flags hidden octaves', () => {
    // CF D3→F3 and CP A3→F4 both rise into an octave
    expect(rules(first([25, 28, 26, 31, 28, 27, 28]))).toContain('hidden')
  })

  it('requires the leading tone at the cadence', () => {
    expect(rules(first([25, 28, 27, 26, 28, 25, 28]))).toContain('cadence')
  })

  it('judges only what is written', () => {
    expect(first([25, null, null, null, null, null, null] as unknown as number[])).toEqual([])
  })
})

describe('generated puzzles', () => {
  const days = ['2026-11-09', '2026-12-25', '2027-03-14']
  for (const species of [1, 2, 3, 4, 5] as Species[]) {
    it(`species ${species}: solutions are valid and given notes come from them`, () => {
      for (const day of days) {
        for (const level of [1, 2, 3, 4, 5] as Level[]) {
          const p = makePuzzle(day, species, level)
          expect(validate(analyze(p.exercise), p.solution)).toEqual([])
          p.given.forEach((g, i) => g !== null && expect(g).toBe(p.solution[i]))
          expect(p.given.some((g) => g === null)).toBe(true)
        }
      }
    })
  }

  it('is the same puzzle for everyone on the same day', () => {
    expect(makePuzzle('2026-11-09', 3, 2)).toEqual(makePuzzle('2026-11-09', 3, 2))
  })
})
