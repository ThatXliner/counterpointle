import { describe, expect, it } from 'vitest'
import { cpNotes, decodeDraft, encodeDraft, exerciseOf, fitFlorid, withBars, type Draft } from './draft'
import { analyze, buildRhythm } from './music/exercise'
import { validate } from './music/rules'

// CF C3 E3 D3 F3 E3 D3 C3 with G3 C4 B3 A3 C4 B3 C4 above: 5 6 6 3 6 6 8.
const textbook: Draft = {
  ...withBars(decodeDraft('', 'fux'), 7),
  cf: [21, 23, 22, 24, 23, 22, 21],
  cp: { 0: 25, 8: 28, 16: 27, 24: 26, 32: 28, 40: 27, 48: 28 },
}
/** Only notes that fall on a slot of the current rhythm make it into a link. */
const linked = (d: Draft): Draft => ({ ...d, cp: Object.fromEntries(exerciseOf(d).slots.flatMap((s) => (s.start in d.cp ? [[s.start, d.cp[s.start]]] : []))) })

describe('verifier drafts', () => {
  it('judges a written exercise with the puzzle rules', () => {
    const ex = exerciseOf(textbook)
    expect(validate(analyze(ex), cpNotes(textbook, ex))).toEqual([])
    const parallel = { ...textbook, cp: { ...textbook.cp, 8: 27 } } // B3 over E3 after G3 over C3
    const ex2 = exerciseOf(parallel)
    expect(validate(analyze(ex2), cpNotes(parallel, ex2)).map((v) => v.rule)).toContain('parallels')
  })

  it('survives a share link', () => {
    const florid: Draft = { ...withBars(textbook, 9), species: 5, key: { mode: 'dorian', sig: -1 }, cpAbove: true, rules: 'fux' }
    florid.florid = fitFlorid([{ durs: [2, 2], tie: false }, { durs: [4, 4], tie: true }, { durs: [2, 1, 1], tie: false }], 9)
    for (const draft of [textbook, florid]) {
      const back = decodeDraft(encodeDraft(draft), 'ap')
      expect(back).toEqual(linked(draft))
    }
  })

  it('falls back to defaults for a mangled link', () => {
    const d = decodeDraft('r=nope&s=9&m=lydian&k=12&cf=Z9.C3', 'ap')
    expect(d.rules).toBe('ap')
    expect(d.species).toBe(1)
    expect(d.key).toEqual({ mode: 'ionian', sig: 0 })
    expect(d.cf).toHaveLength(8)
  })

  it('keeps florid rhythms inside the generator grammar', () => {
    // Bar 1 can't hold two halves after a rest; bar 2 follows a tie; bar 4 must tie into the cadence.
    const fitted = fitFlorid([{ durs: [4, 4], tie: true }, { durs: [4, 4], tie: false }, { durs: [8], tie: false }], 6)
    expect(fitted).toEqual([
      { durs: [4], tie: true },
      { durs: [4], tie: false },
      { durs: [4, 4], tie: false },
      { durs: [4, 4], tie: true },
      { durs: [4], tie: false },
    ])
  })

  it('rhythms for species I to IV match the puzzles', () => {
    for (const species of [1, 2, 3, 4] as const) expect(exerciseOf({ ...textbook, species }).slots).toEqual(buildRhythm(species, 7, Math.random))
  })
})
