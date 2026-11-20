import {
  buildRhythm,
  floridOptions,
  floridSlots,
  floridTie,
  LOWER_RANGE,
  UPPER_RANGE,
  type Exercise,
  type FloridBar,
  type Species,
} from './music/exercise'
import { SPECIES_IN, type Rulebook } from './music/rules'
import { C_MAJOR, letterOf, MODES, octaveOf, type Key, type Mode } from './music/theory'

/** An exercise the player writes from scratch in the verifier: both voices, and the rhythm in fifth species. */
export interface Draft {
  rules: Rulebook
  species: Species
  key: Key
  cpAbove: boolean
  /** One whole note per bar; null marks a bar not written yet. */
  cf: (number | null)[]
  /** Fifth species rhythm of every bar but the last. Kept through species changes so switching back restores it. */
  florid: FloridBar[]
  /** Counterpoint steps by start time, so notes that still line up survive a change of rhythm. */
  cp: Record<number, number>
}

export const MIN_BARS = 5
export const MAX_BARS = 16
export const SIGNATURES = [-3, -2, -1, 0, 1, 2, 3]

export const cantusRange = (cpAbove: boolean): [number, number] => (cpAbove ? LOWER_RANGE : UPPER_RANGE)

export function emptyDraft(rules: Rulebook): Draft {
  return { rules, species: 1, key: C_MAJOR, cpAbove: true, cf: new Array(8).fill(null), florid: fitFlorid([], 8), cp: {} }
}

/** Keeps each bar's chosen rhythm where the grammar still allows it, and falls back to the first option where not. */
export function fitFlorid(florid: readonly FloridBar[], bars: number): FloridBar[] {
  const last = bars - 1
  const out: FloridBar[] = []
  for (let b = 0; b < last; b++) {
    const options = floridOptions(b, last, out[b - 1]?.tie ?? false)
    const want = florid[b]
    const durs = options.find(([d]) => want && d.join() === want.durs.join())?.[0] ?? options[0][0]
    const tie = floridTie(b, last, durs)
    out.push({ durs, tie: tie === 'must' || (tie === 'may' && (want?.tie ?? false)) })
  }
  return out
}

export function withBars(draft: Draft, bars: number): Draft {
  const cf = draft.cf.slice(0, bars)
  while (cf.length < bars) cf.push(null)
  return { ...draft, cf, florid: fitFlorid(draft.florid, bars) }
}

/** The draft as an exercise the rules can judge. Unwritten cantus bars get a stand-in, so judge only a complete cantus. */
export function exerciseOf(draft: Draft): Exercise {
  const { species, rules, key, cpAbove } = draft
  const [lo, hi] = cantusRange(cpAbove)
  const cf = draft.cf.map((s) => s ?? Math.round((lo + hi) / 2))
  const slots = species === 5 ? floridSlots(draft.florid) : buildRhythm(species, cf.length, Math.random)
  return { species, rules, key, cpAbove, cf, slots }
}

export const cpNotes = (draft: Draft, ex: Exercise): (number | null)[] => ex.slots.map((s) => draft.cp[s.start] ?? null)

// --- Share links: #/verify?r=fux&s=2&m=dorian&k=0&v=above&cf=D3.F3.-&cp=…&rh=4t.22 -------------------------

const LETTERS = 'CDEFGAB'
const BLANK = '-'
const stepName = (step: number | null) => (step == null ? BLANK : `${LETTERS[letterOf(step)]}${octaveOf(step)}`)

function parseStep(name: string): number | null {
  const m = name.match(/^([A-G])(\d)$/)
  return m ? Number(m[2]) * 7 + LETTERS.indexOf(m[1]) : null
}

export function encodeDraft(draft: Draft): string {
  const ex = exerciseOf(draft)
  const q = new URLSearchParams({
    r: draft.rules,
    s: String(draft.species),
    m: draft.key.mode,
    k: String(draft.key.sig),
    v: draft.cpAbove ? 'above' : 'below',
    cf: draft.cf.map(stepName).join('.'),
    cp: cpNotes(draft, ex).map(stepName).join('.'),
  })
  if (draft.species === 5) q.set('rh', draft.florid.map((f) => f.durs.join('') + (f.tie ? 't' : '')).join('.'))
  return q.toString()
}

/** Reads a share link, filling in defaults for anything missing or malformed. */
export function decodeDraft(query: string, fallbackRules: Rulebook): Draft {
  const q = new URLSearchParams(query)
  const rules: Rulebook = q.get('r') === 'ap' ? 'ap' : q.get('r') === 'fux' ? 'fux' : fallbackRules
  const base = emptyDraft(rules)
  const species = Number(q.get('s')) as Species
  const mode = q.get('m') as Mode
  const sig = Number(q.get('k'))
  const names = q.get('cf')?.split('.') ?? []
  const bars = names.length >= MIN_BARS && names.length <= MAX_BARS ? names.length : base.cf.length
  const draft: Draft = {
    ...base,
    species: SPECIES_IN[rules].includes(species) ? species : 1,
    key: MODES.includes(mode) && SIGNATURES.includes(sig) ? { mode, sig } : C_MAJOR,
    cpAbove: q.get('v') !== 'below',
    cf: Array.from({ length: bars }, (_, b) => inRangeOrNull(parseStep(names[b] ?? ''), cantusRange(q.get('v') !== 'below'))),
  }
  const rhythm = (q.get('rh')?.split('.') ?? []).map((bar) => ({ durs: bar.replace('t', '').split('').map(Number), tie: bar.endsWith('t') }))
  draft.florid = fitFlorid(rhythm, bars)
  const ex = exerciseOf(draft)
  const range: [number, number] = draft.cpAbove ? UPPER_RANGE : LOWER_RANGE
  q.get('cp')
    ?.split('.')
    .forEach((name, i) => {
      const step = inRangeOrNull(parseStep(name), range)
      if (step !== null && ex.slots[i]) draft.cp[ex.slots[i].start] = step
    })
  return draft
}

const inRangeOrNull = (step: number | null, [lo, hi]: [number, number]) => (step === null || step < lo || step > hi ? null : step)
