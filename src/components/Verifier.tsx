import { useEffect, useMemo, useRef, useState } from 'react'
import { play } from '../audio'
import { ROMAN, SPECIES_INFO } from '../content'
import {
  cantusRange,
  cpNotes,
  encodeDraft,
  exerciseOf,
  fitFlorid,
  MAX_BARS,
  MIN_BARS,
  SIGNATURES,
  withBars,
  type Draft,
} from '../draft'
import { analyze, cfPitch, cpPitch, floridOptions, floridTie, pitchIn, type Species } from '../music/exercise'
import { SPECIES_IN, validate, type Rulebook } from '../music/rules'
import { keyName, midi, MODES, pitchName } from '../music/theory'
import { saveSetting } from '../storage'
import { markFor } from './Game'
import { Segmented } from './Home'
import { RulesCard } from './RulesCard'
import { Staff } from './Staff'
import { usePlayback } from './usePlayback'

/** Moves the counterpoint to the other side of the cantus, keeping the notes that still fit their new ranges. */
function flipVoices(d: Draft, cpAbove: boolean): Draft {
  const [lo, hi] = cantusRange(cpAbove)
  const [cpLo, cpHi] = cantusRange(!cpAbove)
  const cp = Object.fromEntries(Object.entries(d.cp).filter(([, s]) => s >= cpLo && s <= cpHi))
  return { ...d, cpAbove, cf: d.cf.map((s) => (s != null && s >= lo && s <= hi ? s : null)), cp }
}

type Selection = { voice: 'cf' | 'cp'; index: number } | null

const VALUE_NAME: Record<number, string> = { 8: '1', 4: '½', 2: '¼', 1: '⅛' }
const rhythmLabel = (durs: readonly number[], tie: boolean) => durs.map((d) => VALUE_NAME[d]).join(' ') + (tie ? ' ⁀' : '')

interface VerifierProps {
  initial: Draft
  showFigures: boolean
  sound: boolean
  share: (text: string) => void
  onBack: () => void
}

export function Verifier({ initial, showFigures, sound, share, onBack }: VerifierProps) {
  const [draft, setDraft] = useState(initial)
  const [selected, setSelected] = useState<Selection>({ voice: 'cf', index: 0 })
  const [highlight, setHighlight] = useState<number[]>([])
  const ex = useMemo(() => exerciseOf(draft), [draft])
  const ctx = useMemo(() => analyze(ex), [ex])
  const notes = useMemo(() => cpNotes(draft, ex), [draft, ex])
  const cantusDone = draft.cf.every((s) => s != null)
  const violations = useMemo(
    () => (cantusDone ? validate(ctx, notes).sort((a, b) => (a.bar ?? Infinity) - (b.bar ?? Infinity)) : []),
    [cantusDone, ctx, notes],
  )
  const marks = useMemo(() => notes.map((n, i) => (n == null || !cantusDone ? null : markFor(i, violations))), [notes, cantusDone, violations])
  const { playTime, togglePlay } = usePlayback(ctx, notes)

  useEffect(() => {
    const query = encodeDraft(draft)
    history.replaceState(null, '', `#/verify?${query}`)
    saveSetting('verifier', query)
  }, [draft])

  const update = (change: (d: Draft) => Draft) => {
    setDraft(change)
    setHighlight([])
  }

  const audition = (cf: number | null, cp: number | null) => {
    if (!sound || playTime !== null) return
    play([cf, cp].flatMap((m) => (m == null ? [] : [{ midi: m, at: 0, dur: 0.7 }])))
  }

  const setCantus = (bar: number, step: number | null) => {
    update((d) => ({ ...d, cf: d.cf.map((s, b) => (b === bar ? step : s)) }))
    if (step === null) return
    const under = ctx.slots.findIndex((s) => s.bar === bar && s.offset === 0)
    audition(midi(pitchIn(draft.key, step)), under >= 0 && notes[under] != null ? midi(cpPitch(ctx, under, notes[under]!)) : null)
  }

  const setNote = (slot: number, step: number | null) => {
    const { start } = ctx.slots[slot]
    update((d) => {
      const cp = { ...d.cp }
      if (step === null) delete cp[start]
      else cp[start] = step
      return { ...d, cp }
    })
    if (step === null) return
    const s = ctx.slots[slot]
    const bar = s.tiesOver ? s.bar + 1 : s.bar
    audition(draft.cf[bar] != null ? midi(cfPitch(ctx, bar)) : null, midi(cpPitch(ctx, slot, step)))
  }

  const current = selected === null ? null : selected.voice === 'cf' ? draft.cf[selected.index] : notes[selected.index]
  const write = (step: number | null) => {
    if (selected?.voice === 'cf') setCantus(selected.index, step)
    else if (selected) setNote(selected.index, step)
  }

  const nudge = (delta: number) => {
    if (!selected) return
    const [lo, hi] = selected.voice === 'cf' ? cantusRange(draft.cpAbove) : ctx.range
    const length = selected.voice === 'cf' ? draft.cf.length : notes.length
    const line = selected.voice === 'cf' ? draft.cf : notes
    const neighbor = [selected.index - 1, selected.index + 1].filter((i) => i >= 0 && i < length).map((i) => line[i]).find((n) => n != null)
    const start = current ?? neighbor ?? Math.round((lo + hi) / 2) - delta
    write(Math.min(hi, Math.max(lo, start + delta)))
  }

  const moveSelection = (dir: 1 | -1) => {
    if (!selected) return setSelected({ voice: 'cf', index: 0 })
    const length = selected.voice === 'cf' ? draft.cf.length : notes.length
    setSelected({ ...selected, index: (selected.index + dir + length) % length })
  }

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, select, dialog[open]')) return
    if ((e.key === 'Enter' || e.key === ' ') && target.closest('button, summary, a')) return
    const actions: Record<string, () => void> = {
      ArrowLeft: () => moveSelection(-1),
      ArrowRight: () => moveSelection(1),
      ArrowUp: () => nudge(e.shiftKey ? 7 : 1),
      ArrowDown: () => nudge(e.shiftKey ? -7 : -1),
      Backspace: () => write(null),
      Delete: () => write(null),
      ' ': togglePlay,
    }
    const action = actions[e.key]
    if (!action) return
    e.preventDefault()
    action()
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const setRules = (rules: Rulebook) =>
    update((d) => ({ ...d, rules, species: SPECIES_IN[rules].includes(d.species) ? d.species : SPECIES_IN[rules][SPECIES_IN[rules].length - 1] }))
  const setSpecies = (species: Species) => {
    setSelected((s) => (s?.voice === 'cp' ? null : s))
    update((d) => ({ ...d, species }))
  }
  const setBars = (bars: number) => {
    setSelected(null)
    update((d) => withBars(d, bars))
  }
  const setRhythm = (bar: number, value: string) => {
    const [durs, tie] = value.split('|')
    setSelected(null)
    update((d) => ({
      ...d,
      florid: fitFlorid(
        d.florid.map((f, b) => (b === bar ? { durs: durs.split(',').map(Number), tie: tie === 't' } : f)),
        d.cf.length,
      ),
    }))
  }

  const written = notes.filter((n) => n != null).length
  const cantusLeft = draft.cf.filter((s) => s == null).length
  const blank = written === 0 && cantusLeft === draft.cf.length
  const reset = () => {
    if (!confirm('Erase every note in both voices?')) return
    setSelected({ voice: 'cf', index: 0 })
    update((d) => ({ ...d, cf: d.cf.map(() => null), cp: {} }))
  }
  const selectedName =
    current == null ? '—' : selected!.voice === 'cf' ? pitchName(pitchIn(draft.key, current)) : pitchName(cpPitch(ctx, selected!.index, current))
  const lastBar = draft.cf.length - 1

  return (
    <section className="game verifier">
      <header className="game-head">
        <button className="link" onClick={onBack}>
          ← Today
        </button>
        <div>
          <h2>Counterpoint checker</h2>
          <p className="dim">Write a cantus firmus and a line against it. Every rule is checked as you go.</p>
        </div>
      </header>

      <div className="verifier-controls">
        <Segmented<Rulebook> label="Rulebook" value={draft.rules} options={[['fux', 'Fux'], ['ap', 'AP']]} onChange={setRules} />
        <Segmented<string>
          label="Species"
          value={String(draft.species)}
          options={SPECIES_IN[draft.rules].map((s) => [String(s), ROMAN[s]] as const)}
          onChange={(s) => setSpecies(Number(s) as Species)}
        />
        <Segmented<string>
          label="Counterpoint"
          value={draft.cpAbove ? 'above' : 'below'}
          options={[['above', 'Line above'], ['below', 'Line below']]}
          onChange={(v) => {
            setSelected(null)
            update((d) => flipVoices(d, v === 'above'))
          }}
        />
        <label className="picker">
          <span className="dim">Key</span>
          <select
            value={`${draft.key.mode}:${draft.key.sig}`}
            onChange={(e) => {
              const [mode, sig] = e.target.value.split(':')
              update((d) => ({ ...d, key: { mode: mode as Draft['key']['mode'], sig: Number(sig) } }))
            }}
          >
            {MODES.map((mode) => (
              <optgroup key={mode} label={keyName({ mode, sig: 0 }).split(' ')[1]}>
                {SIGNATURES.map((sig) => (
                  <option key={sig} value={`${mode}:${sig}`}>
                    {keyName({ mode, sig })}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="picker stepper">
          <span className="dim">Bars</span>
          <button onClick={() => setBars(draft.cf.length - 1)} disabled={draft.cf.length <= MIN_BARS} aria-label="One bar fewer">
            −
          </button>
          <span className="count">{draft.cf.length}</span>
          <button onClick={() => setBars(draft.cf.length + 1)} disabled={draft.cf.length >= MAX_BARS} aria-label="One bar more">
            +
          </button>
        </div>
      </div>

      <div className="card score">
        <Staff
          ctx={ctx}
          notes={notes}
          given={notes.map(() => null)}
          marks={marks}
          selected={selected?.voice === 'cp' ? selected.index : null}
          editable
          showFigures={showFigures && cantusDone}
          highlight={highlight}
          playTime={playTime}
          onPick={(slot, step) => {
            setSelected({ voice: 'cp', index: slot })
            setNote(slot, step)
          }}
          cantus={{
            notes: draft.cf,
            selected: selected?.voice === 'cf' ? selected.index : null,
            onPick: (bar, step) => {
              setSelected({ voice: 'cf', index: bar })
              setCantus(bar, step)
            },
          }}
        />
      </div>

      {draft.species === 5 && (
        <div className="rhythm-picker" aria-label="Rhythm of each bar">
          {draft.florid.map((f, b) => {
            const options = floridOptions(b, lastBar, draft.florid[b - 1]?.tie ?? false).flatMap(([durs]) => {
              const tie = floridTie(b, lastBar, durs)
              return tie === 'may' ? [[durs, false], [durs, true]] as const : [[durs, tie === 'must']] as const
            })
            return (
              <label key={b} className="picker">
                <span className="dim">{b + 1}</span>
                <select value={`${f.durs.join()}|${f.tie ? 't' : ''}`} onChange={(e) => setRhythm(b, e.target.value)} disabled={options.length < 2}>
                  {options.map(([durs, tie]) => (
                    <option key={`${durs.join()}${tie}`} value={`${durs.join()}|${tie ? 't' : ''}`}>
                      {rhythmLabel(durs, tie)}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
        </div>
      )}

      <div className="toolbar">
        <button className="ghost-btn" onClick={togglePlay} aria-label={playTime !== null ? 'Stop' : 'Play'} disabled={!cantusDone}>
          {playTime !== null ? '■ Stop' : '▶ Play'}
        </button>
        <div className="nudge">
          <button onClick={() => nudge(-1)} aria-label="Lower the selected note" disabled={!selected}>
            ▼
          </button>
          <span className="pitch" aria-live="polite">
            {selectedName}
          </span>
          <button onClick={() => nudge(1)} aria-label="Raise the selected note" disabled={!selected}>
            ▲
          </button>
          <button onClick={() => write(null)} aria-label="Erase the selected note" disabled={current == null}>
            ✕
          </button>
        </div>
        <div className="toolbar-group">
          <button className="ghost-btn" onClick={reset} disabled={blank}>
            Reset
          </button>
          <button className="ghost-btn" onClick={() => share(location.href)}>
            Copy link
          </button>
        </div>
      </div>
      <p className="hint dim">
        Tap either staff to place a note, then drag it up or down.
        <span className="keys"> Keys: ← → choose, ↑ ↓ move, Space plays.</span>
      </p>

      <div className={`card result${cantusDone && written === notes.length && violations.length === 0 ? ' won' : ''}`} aria-live="polite">
        <h3>
          {!cantusDone
            ? `Write the cantus firmus first`
            : violations.length
              ? `${violations.length} ${violations.length === 1 ? 'rule' : 'rules'} broken`
              : written === notes.length
                ? 'Breaks no rules'
                : 'Nothing wrong so far'}
        </h3>
        <p className="dim">
          {!cantusDone
            ? `${cantusLeft} of ${draft.cf.length} bars still empty. The counterpoint is checked once every bar has a note.`
            : `${written} of ${notes.length} counterpoint notes written. ${SPECIES_INFO[draft.species].name} by ${draft.rules === 'ap' ? 'AP' : 'Fux'} rules, in ${keyName(draft.key)}.`}
        </p>
        {violations.length > 0 && (
          <div className="violations">
            <ul>
              {violations.map((v, k) => (
                <li
                  key={k}
                  className={`v-${v.kind}`}
                  onMouseEnter={() => setHighlight(v.slots)}
                  onMouseLeave={() => setHighlight([])}
                  onClick={() => {
                    setHighlight(v.slots)
                    if (v.slots.length) setSelected({ voice: 'cp', index: v.slots[0] })
                  }}
                >
                  <span className="dot" />
                  {v.bar !== null && <span className="bar">Bar {v.bar}</span>}
                  {v.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <RulesCard rules={draft.rules} species={draft.species} />
    </section>
  )
}
