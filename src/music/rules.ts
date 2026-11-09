import { cfPitch, cpPitch, type Context } from './exercise'
import {
  badLeapChain,
  degree,
  intervalBetween,
  intervalName,
  melodicProblem,
  midi,
  unrecoveredLeap,
  type Interval,
} from './theory'

export type RuleId =
  | 'opening'
  | 'final'
  | 'cadence'
  | 'dissonance'
  | 'suspension'
  | 'parallels'
  | 'hidden'
  | 'unison'
  | 'crossing'
  | 'spacing'
  | 'thirds-sixths'
  | 'repeat'
  | 'interval'
  | 'leap'
  | 'leaps'
  | 'range'
  | 'eighths'

/** Harmonic rules concern the counterpoint against the cantus; melodic ones the shape of its line. */
export type RuleKind = 'harmonic' | 'melodic'

const MELODIC: ReadonlySet<RuleId> = new Set(['repeat', 'interval', 'leap', 'leaps', 'range', 'eighths'])

export interface Violation {
  rule: RuleId
  kind: RuleKind
  message: string
  /** Counterpoint notes involved. */
  slots: number[]
  /** 1-based bar number, or null for whole-line problems. */
  bar: number | null
}

type Steps = readonly (number | null)[]

/** Three-valued logic: a rule whose notes are not all written yet is undecided (null). */
type Tri = boolean | null
const all = (...xs: Tri[]): Tri => (xs.includes(false) ? false : xs.includes(null) ? null : true)
const any = (...xs: Tri[]): Tri => (xs.includes(true) ? true : xs.includes(null) ? null : false)

const plural = (iv: Interval) => (iv.perfect === 'fifth' ? 'fifths' : iv.size === 0 ? 'unisons' : 'octaves')

/**
 * Every rule broken by the counterpoint `steps` (null = not yet written).
 * Rules that depend on an unwritten note are skipped, so a partial answer is judged only on what is there.
 */
export function validate(ctx: Context, steps: Steps): Violation[] {
  const { ex, slots, moments, bars } = ctx
  const out: Violation[] = []
  const seen = new Set<string>()
  const last = slots.length - 1

  const add = (rule: RuleId, message: string, ids: number[], bar: number | null = slots[ids[ids.length - 1]].bar) => {
    const key = `${rule}:${ids.join(',')}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ rule, kind: MELODIC.has(rule) ? 'melodic' : 'harmonic', message, slots: ids, bar: bar === null ? null : bar + 1 })
  }
  const known = (i: number) => i >= 0 && i <= last && steps[i] != null
  const pitch = (i: number) => cpPitch(ctx, i, steps[i]!)
  const against = (i: number, bar: number) => intervalBetween(pitch(i), cfPitch(ctx, bar))

  // --- Opening, final and cadence ---------------------------------------------------------------
  if (known(0)) {
    const iv = against(0, slots[0].bar)
    if (ex.cpAbove ? !iv.perfect : iv.perfect !== 'octave')
      add('opening', ex.cpAbove ? 'Begin on a unison, fifth or octave' : 'Below the cantus, begin on a unison or octave', [0])
  }
  if (known(last) && against(last, bars - 1).perfect !== 'octave') add('final', 'End on a unison or octave', [last])
  if (known(last - 1)) {
    if (degree(steps[last - 1]!, ex.mode) !== 6)
      add('cadence', 'The second-to-last note must be the leading tone', [last - 1])
    else if (known(last) && steps[last]! - steps[last - 1]! !== 1)
      add('cadence', 'The leading tone must rise by step to the final', [last - 1, last])
  }

  // --- Voice crossing and spacing ---------------------------------------------------------------
  for (const m of moments) {
    if (!known(m.slot)) continue
    const cp = steps[m.slot]!
    const cf = ex.cf[m.bar]
    if (ex.cpAbove ? cp < cf : cp > cf)
      add('crossing', ex.cpAbove ? 'The counterpoint crosses below the cantus' : 'The counterpoint crosses above the cantus', [m.slot], m.bar)
    if (Math.abs(cp - cf) > 11) add('spacing', 'Voices more than a twelfth apart', [m.slot], m.bar)
  }

  // --- Dissonance treatment ---------------------------------------------------------------------
  const florid = ex.species === 3 || ex.species === 5
  const treatment = (i: number): Tri => {
    if (i === 0 || i === last) return false
    const s = slots[i]
    const inn = known(i - 1) ? steps[i]! - steps[i - 1]! : null
    const out = known(i + 1) ? steps[i + 1]! - steps[i]! : null
    const isStep = (d: number | null): Tri => (d === null ? null : Math.abs(d) === 1)
    const sameWay: Tri = inn === null || out === null ? null : Math.sign(inn) === Math.sign(out)
    const passing = all(isStep(inn), isStep(out), sameWay)
    if (!florid || s.dur > 2) return passing
    const neighbor = all(isStep(inn), isStep(out), sameWay === null ? null : !sameWay)
    // Nota cambiata: step down onto the dissonance, leap down a third, then step back up.
    let cambiata: Tri = false
    if (s.dur === 2 && i + 2 <= last) {
      const out2 = known(i + 1) && known(i + 2) ? steps[i + 2]! - steps[i + 1]! : null
      cambiata = all(inn === null ? null : inn === -1, out === null ? null : out === -2, out2 === null ? null : out2 === 1)
    }
    return any(passing, neighbor, cambiata)
  }
  for (let i = 0; i <= last; i++) {
    if (!known(i)) continue
    const s = slots[i]
    if (against(i, s.bar).consonance !== 'dissonant') continue
    if (s.offset === 0) add('dissonance', 'Dissonance on a downbeat', [i])
    else if (s.tiesOver) add('dissonance', 'A note tied over the barline must begin as a consonance', [i])
    else if (treatment(i) === false) {
      const hint =
        !florid || s.dur > 2
          ? 'A dissonant weak beat must be a passing tone'
          : 'Dissonance must be a passing tone, neighbor tone or cambiata'
      add('dissonance', hint, [i - 1, i, i + 1].filter((j) => j >= 0 && j <= last))
    }
  }

  // --- Suspensions: a note held into a downbeat against a new cantus note -----------------------
  for (let i = 0; i < last; i++) {
    const s = slots[i]
    if (!s.tiesOver || !known(i)) continue
    const bar = s.bar + 1
    const iv = against(i, bar)
    if (iv.consonance !== 'dissonant') continue
    const allowed = ex.cpAbove ? iv.simple === 6 || iv.simple === 3 || (iv.simple === 1 && iv.size > 7) : iv.simple === 1 || iv.simple === 3
    if (!allowed)
      add('suspension', ex.cpAbove ? 'Above the cantus, only 7–6, 4–3 and 9–8 suspensions work' : 'Below the cantus, only 2–3 and 4–5 suspensions work', [i], bar)
    if (!known(i + 1)) continue
    if (steps[i + 1]! - steps[i]! !== -1) add('suspension', 'A suspension must resolve down by step', [i, i + 1], bar)
    else if (against(i + 1, slots[i + 1].bar).consonance === 'dissonant')
      add('suspension', 'A suspension must resolve to a consonance', [i, i + 1], bar)
  }

  // --- Unisons in mid-phrase --------------------------------------------------------------------
  for (const k of ctx.downbeats) {
    const m = moments[k]
    if (m.bar === 0 || m.bar === bars - 1 || !known(m.slot)) continue
    const iv = against(m.slot, m.bar)
    if (iv.size === 0 && iv.perfect) add('unison', 'Unisons belong only at the beginning and end', [m.slot], m.bar)
  }

  // --- Parallel and hidden perfect consonances --------------------------------------------------
  for (let k = 1; k < moments.length; k++) {
    const cur = moments[k]
    const prev = moments[k - 1]
    if (!cur.cfAttack || !cur.cpAttack || !known(prev.slot) || !known(cur.slot)) continue
    const now = against(cur.slot, cur.bar)
    if (!now.perfect) continue
    const cpMove = midi(pitch(cur.slot)) - midi(pitch(prev.slot))
    const cfMove = ex.cf[cur.bar] - ex.cf[prev.bar]
    if (cpMove === 0) continue
    const before = against(prev.slot, prev.bar)
    const ids = [prev.slot, cur.slot]
    if (before.perfect === now.perfect) {
      const similar = Math.sign(cpMove) === Math.sign(cfMove)
      add('parallels', similar ? `Parallel ${plural(now)}` : `Consecutive ${plural(now)} by contrary motion`, ids, cur.bar)
    } else if (Math.sign(cpMove) === Math.sign(cfMove)) {
      add('hidden', `Hidden ${now.perfect}: don't approach a perfect interval by similar motion`, ids, cur.bar)
    }
  }
  if (ex.species > 1) {
    for (let b = 1; b < bars; b++) {
      const a = moments[ctx.downbeats[b - 1]].slot
      const c = moments[ctx.downbeats[b]].slot
      if (a === c || !known(a) || !known(c) || steps[a] === steps[c]) continue
      const before = against(a, b - 1)
      const now = against(c, b)
      if (now.perfect && before.perfect === now.perfect) add('parallels', `${cap(plural(now))} on consecutive downbeats`, [a, c], b)
    }
  }
  if (ex.species === 4) {
    for (let i = 1; i <= last; i++) {
      const [a, c] = [slots[i - 1], slots[i]]
      if (a.offset !== 4 || c.offset !== 4 || c.bar !== a.bar + 1 || !known(i - 1) || !known(i)) continue
      const before = against(i - 1, a.bar)
      const now = against(i, c.bar)
      if (now.perfect && before.perfect === now.perfect) add('parallels', `${cap(plural(now))} on consecutive upbeats`, [i - 1, i], c.bar)
    }
  }
  if (ex.species === 1) {
    let run = 0
    let prevSimple = -1
    for (let i = 0; i <= last; i++) {
      const iv = known(i) ? against(i, slots[i].bar) : null
      const simple = iv && iv.consonance === 'imperfect' ? iv.simple : -1
      run = simple >= 0 && simple === prevSimple ? run + 1 : 1
      prevSimple = simple
      if (simple >= 0 && run > 3)
        add('thirds-sixths', `More than three parallel ${simple === 2 ? 'thirds' : 'sixths'} in a row`, [i - 3, i - 2, i - 1, i])
    }
  }

  // --- The melodic line -------------------------------------------------------------------------
  for (let i = 1; i <= last; i++) {
    if (!known(i - 1) || !known(i)) continue
    const [a, b] = [pitch(i - 1), pitch(i)]
    if (a.step === b.step && a.alter === b.alter) add('repeat', 'Repeated note', [i - 1, i])
    else {
      const problem = melodicProblem(a, b)
      if (problem) add('interval', `Unsingable leap: ${problem}`, [i - 1, i])
    }
  }
  for (let i = 2; i <= last; i++) {
    if (!known(i - 2) || !known(i - 1) || !known(i)) continue
    const d1 = steps[i - 1]! - steps[i - 2]!
    const d2 = steps[i]! - steps[i - 1]!
    if (unrecoveredLeap(d1, d2))
      add('leap', `After a leap of a ${intervalName(Math.abs(d1))}, turn back the other way`, [i - 2, i - 1, i])
    if (badLeapChain(pitch(i - 2), pitch(i - 1), pitch(i)))
      add('leaps', 'Two leaps in one direction must outline a consonant chord', [i - 2, i - 1, i])
    else if (i >= 3 && known(i - 3)) {
      const d0 = steps[i - 2]! - steps[i - 3]!
      if ([d0, d1, d2].every((d) => Math.abs(d) >= 2 && Math.sign(d) === Math.sign(d0)))
        add('leaps', 'Three leaps in a row in the same direction', [i - 3, i - 2, i - 1, i])
    }
  }
  const written = steps.flatMap((s, i) => (s == null ? [] : [i]))
  if (written.length > 1) {
    const vals = written.map((i) => steps[i]!)
    const [lo, hi] = [Math.min(...vals), Math.max(...vals)]
    if (hi - lo > 9)
      add('range', 'Range wider than a tenth', written.filter((i) => steps[i] === lo || steps[i] === hi), null)
  }
  if (ex.species === 5) {
    for (let i = 0; i <= last; i++) {
      if (slots[i].dur !== 1) continue
      for (const j of [i - 1, i + 1]) {
        if (known(i) && known(j) && Math.abs(steps[j]! - steps[i]!) !== 1)
          add('eighths', 'Eighth notes move by step', [Math.min(i, j), Math.max(i, j)])
      }
    }
  }
  return out
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
