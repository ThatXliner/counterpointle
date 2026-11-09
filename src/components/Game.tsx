import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { play, type Tone } from '../audio'
import { AP_SPECIES_RULES, GENERAL_RULES, ROMAN, RULEBOOK_NAME, SPECIES_INFO } from '../content'
import { analyze, BAR, cfPitch, cpPitch, type Context, type Species } from '../music/exercise'
import type { Level, Puzzle, Variant } from '../music/generate'
import { validate, type Violation } from '../music/rules'
import { keyName, midi, pitchName } from '../music/theory'
import { LEVELS, loadPuzzle, MAX_CHECKS, siteUrl, speciesFor } from '../puzzles'
import { loadGame, saveGame, type Attempt, type GameState, type Mark } from '../storage'
import { gameTitle } from './Home'
import { Staff } from './Staff'

const EIGHTH_SECONDS = 0.17
const SQUARE: Record<Mark, string> = { ok: '🟩', melodic: '🟨', harmonic: '🟥' }
const RANK: Record<Mark, number> = { ok: 0, melodic: 1, harmonic: 2 }
const PRAISE = {
  ap: ['Textbook.', 'Clean voice leading.', 'Bellissimo.', 'That’s a 5 on the free response.'],
  fux: ['Gradus ad Parnassum!', 'Fux would approve.', 'Bellissimo.', 'Clean voice leading.'],
}

interface GameProps {
  day: string
  species: Species
  level: Level
  variant: Variant
  showFigures: boolean
  sound: boolean
  toast: (msg: string) => void
  share: (text: string) => void
  onNavigate: (species: Species, level: Level | null) => void
}

export function Game(props: GameProps) {
  const { day, species, level, variant } = props
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  useEffect(() => {
    let live = true
    setPuzzle(null)
    void loadPuzzle(day, species, level, variant).then((p) => live && setPuzzle(p))
    return () => {
      live = false
    }
  }, [day, species, level, variant])
  if (!puzzle) return <p className="composing">Composing a cantus firmus…</p>
  return <Board key={puzzle.key} puzzle={puzzle} {...props} />
}

function markFor(slot: number, violations: Violation[]): Mark {
  const involved = violations.filter((v) => v.slots.includes(slot))
  if (involved.some((v) => v.kind === 'harmonic')) return 'harmonic'
  return involved.length ? 'melodic' : 'ok'
}

function tonesFor(ctx: Context, notes: readonly (number | null)[]): Tone[] {
  const cf = ctx.ex.cf.map((_, b) => ({ midi: midi(cfPitch(ctx, b)), at: b * BAR * EIGHTH_SECONDS, dur: BAR * EIGHTH_SECONDS }))
  const cp = ctx.slots.flatMap((s, i) =>
    notes[i] == null ? [] : [{ midi: midi(cpPitch(ctx, i, notes[i]!)), at: s.start * EIGHTH_SECONDS, dur: s.dur * EIGHTH_SECONDS }],
  )
  return [...cf, ...cp]
}

function Board({ puzzle, day, variant, showFigures, sound, toast, share, onNavigate }: GameProps & { puzzle: Puzzle }) {
  const ctx = useMemo(() => analyze(puzzle.exercise), [puzzle])
  const { given, species, level } = puzzle
  const { rules } = puzzle.exercise
  const blanks = useMemo(() => given.flatMap((g, i) => (g === null ? [i] : [])), [given])
  const [state, setState] = useState<GameState>(
    () => loadGame(puzzle.key) ?? { notes: [...given], marks: given.map(() => null), attempts: [], status: 'playing' },
  )
  const [selected, setSelected] = useState<number | null>(() =>
    state.status === 'playing' ? (blanks.find((i) => state.notes[i] == null) ?? blanks[0]) : null,
  )
  const [highlight, setHighlight] = useState<number[]>([])
  const [reveal, setReveal] = useState(false)
  const [playTime, setPlayTime] = useState<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => saveGame(puzzle.key, state), [puzzle.key, state])
  useEffect(() => () => stopRef.current?.(), [])

  const editable = state.status === 'playing'
  const notes = reveal ? puzzle.solution : state.notes
  const latest = state.attempts[state.attempts.length - 1]

  const audition = useCallback(
    (slot: number, step: number) => {
      if (!sound || playTime !== null) return
      const s = ctx.slots[slot]
      const cfBar = s.tiesOver ? s.bar + 1 : s.bar
      play([
        { midi: midi(cfPitch(ctx, cfBar)), at: 0, dur: 0.7 },
        { midi: midi(cpPitch(ctx, slot, step)), at: 0, dur: 0.7 },
      ])
    },
    [ctx, sound, playTime],
  )

  const setNote = useCallback(
    (slot: number, step: number | null) => {
      setState((s) => {
        if (s.status !== 'playing' || given[slot] !== null || s.notes[slot] === step) return s
        const notes = [...s.notes]
        const marks = [...s.marks]
        notes[slot] = step
        marks[slot] = null
        return { ...s, notes, marks }
      })
      if (step !== null) audition(slot, step)
    },
    [given, audition],
  )

  const pick = (slot: number, step: number) => {
    setSelected(slot)
    setHighlight([])
    setNote(slot, step)
  }

  const nudge = (delta: number) => {
    if (selected === null) return
    const [lo, hi] = ctx.range
    const current = state.notes[selected]
    const neighbor = [selected - 1, selected + 1].map((i) => state.notes[i]).find((n) => n != null)
    const start = current ?? neighbor ?? ctx.ex.cf[ctx.slots[selected].bar] + (ctx.ex.cpAbove ? 4 : -4) - delta
    setNote(selected, Math.min(hi, Math.max(lo, start + delta)))
  }

  const moveSelection = (dir: 1 | -1) => {
    if (!blanks.length) return
    const at = selected === null ? -1 : blanks.indexOf(selected)
    setSelected(blanks[(at + dir + blanks.length) % blanks.length])
  }

  const check = () => {
    if (!editable) return
    if (blanks.some((i) => state.notes[i] == null)) return toast('Fill in every blank first')
    const violations = validate(ctx, state.notes).sort((a, b) => (a.bar ?? Infinity) - (b.bar ?? Infinity))
    const marks = state.notes.map((_, i) => (given[i] === null ? markFor(i, violations) : null))
    const bars: Mark[] = []
    for (let b = 0; b < ctx.bars; b++) {
      const here = blanks.filter((i) => ctx.slots[i].bar === b).map((i) => marks[i]!)
      if (here.length) bars.push(here.reduce((w, m) => (RANK[m] > RANK[w] ? m : w), 'ok' as Mark))
    }
    const attempts: Attempt[] = [...state.attempts, { bars, violations }]
    const status = violations.length === 0 ? 'won' : attempts.length >= MAX_CHECKS ? 'lost' : 'playing'
    setState({ ...state, marks, attempts, status })
    if (status !== 'playing') setSelected(null)
    if (status === 'won') toast(PRAISE[rules][attempts.length % 4])
  }

  const togglePlay = () => {
    if (stopRef.current) {
      stopRef.current()
      stopRef.current = null
      setPlayTime(null)
      return
    }
    const handle = play(tonesFor(ctx, notes))
    const total = ctx.bars * BAR
    let frame = 0
    const tick = () => {
      const t = handle.now() / EIGHTH_SECONDS
      if (t >= total || !stopRef.current) {
        stopRef.current = null
        setPlayTime(null)
        return
      }
      setPlayTime(Math.max(0, t))
      frame = requestAnimationFrame(tick)
    }
    stopRef.current = () => {
      cancelAnimationFrame(frame)
      handle.stop()
    }
    frame = requestAnimationFrame(tick)
  }

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, dialog[open]')) return
    // Enter and Space on a focused control should activate that control.
    if ((e.key === 'Enter' || e.key === ' ') && target.closest('button, summary, a')) return
    const erase = () => selected !== null && setNote(selected, null)
    const actions: Record<string, () => void> = {
      ArrowLeft: () => moveSelection(-1),
      ArrowRight: () => moveSelection(1),
      ArrowUp: () => nudge(e.shiftKey ? 7 : 1),
      ArrowDown: () => nudge(e.shiftKey ? -7 : -1),
      Backspace: erase,
      Delete: erase,
      Enter: check,
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

  const shareResult = () => {
    const result = state.status === 'won' ? `${state.attempts.length}/${MAX_CHECKS}` : `X/${MAX_CHECKS}`
    const text = [
      [gameTitle(day, variant), `Species ${ROMAN[species]}`, `Level ${level}`, result].join(' · '),
      ...state.attempts.map((a) => a.bars.map((m) => SQUARE[m]).join('')),
      siteUrl(),
    ].join('\n')
    share(text)
  }

  const info = SPECIES_INFO[species]
  const selectedName = selected !== null && state.notes[selected] != null ? pitchName(cpPitch(ctx, selected, state.notes[selected]!)) : '—'
  const filled = blanks.filter((i) => state.notes[i] != null).length

  return (
    <section className="game">
      <header className="game-head">
        <button className="link" onClick={() => onNavigate(species, null)}>
          ← Today
        </button>
        <div>
          <h2>
            Species {ROMAN[species]} <span className="dim">·</span> Level {level}
          </h2>
          <p className="dim">
            {info.tagline} · {keyName(ctx.ex.key)} · line {ctx.ex.cpAbove ? 'above' : 'below'} the cantus
          </p>
        </div>
      </header>

      <div className="card score">
        <Staff
          ctx={ctx}
          notes={notes}
          given={given}
          marks={reveal ? given.map(() => null) : state.marks}
          selected={editable ? selected : null}
          editable={editable}
          showFigures={showFigures}
          highlight={highlight}
          playTime={playTime}
          onPick={pick}
        />
      </div>

      <div className="toolbar">
        <button className="ghost-btn" onClick={togglePlay} aria-label={playTime !== null ? 'Stop' : 'Play'}>
          {playTime !== null ? '■ Stop' : '▶ Play'}
        </button>
        {editable && (
          <div className="nudge">
            <button onClick={() => nudge(-1)} aria-label="Lower the selected note" disabled={selected === null}>
              ▼
            </button>
            <span className="pitch" aria-live="polite">
              {selectedName}
            </span>
            <button onClick={() => nudge(1)} aria-label="Raise the selected note" disabled={selected === null}>
              ▲
            </button>
            <button onClick={() => selected !== null && setNote(selected, null)} aria-label="Erase the selected note" disabled={selected === null}>
              ✕
            </button>
          </div>
        )}
        {editable && (
          <button className="primary" onClick={check} disabled={filled < blanks.length}>
            Check <span className="count">{MAX_CHECKS - state.attempts.length} left</span>
          </button>
        )}
      </div>
      {editable && (
        <p className="hint dim">
          Tap a blank to place a note, then drag it up or down.
          <span className="keys"> Keys: ← → choose, ↑ ↓ move, Enter checks, Space plays.</span>
        </p>
      )}

      {state.status !== 'playing' && (
        <div className={`card result ${state.status}`}>
          <h3>{state.status === 'won' ? `Solved in ${state.attempts.length} of ${MAX_CHECKS}` : 'Out of checks'}</h3>
          <p className="dim">
            {state.status === 'won'
              ? 'Your counterpoint breaks no rules. There are usually many answers. This one is yours.'
              : 'There is more than one right answer. Want to see one?'}
          </p>
          <div className="row">
            <button className="primary" onClick={shareResult}>
              Share result
            </button>
            {state.status === 'lost' && (
              <button className="ghost-btn" onClick={() => setReveal((r) => !r)}>
                {reveal ? 'Show my attempt' : 'Show a solution'}
              </button>
            )}
            {level < LEVELS.length ? (
              <button className="ghost-btn" onClick={() => onNavigate(species, (level + 1) as Level)}>
                Level {level + 1} →
              </button>
            ) : speciesFor(variant).includes((species + 1) as Species) ? (
              <button className="ghost-btn" onClick={() => onNavigate((species + 1) as Species, 1)}>
                Species {ROMAN[species + 1]} →
              </button>
            ) : null}
          </div>
        </div>
      )}

      {latest && (
        <div className="feedback">
          <div className="tries" aria-label="Your checks">
            {state.attempts.map((a, k) => (
              <div className="try-row" key={k}>
                {a.bars.map((m, j) => (
                  <span key={j} className={`sq mark-${m}`} />
                ))}
              </div>
            ))}
          </div>
          {latest.violations.length > 0 && (
            <div className="violations">
              <h4>{reveal ? 'Your last check' : 'Last check'}</h4>
              <ul>
                {latest.violations.map((v, k) => (
                  <li
                    key={k}
                    className={`v-${v.kind}`}
                    onMouseEnter={() => setHighlight(v.slots)}
                    onMouseLeave={() => setHighlight([])}
                    onClick={() => {
                      setHighlight(v.slots)
                      const target = v.slots.find((i) => given[i] === null)
                      if (editable && target !== undefined) setSelected(target)
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
      )}

      <details className="card rules">
        <summary>
          Rules for {info.name.toLowerCase()} <span className="dim">· {info.tagline.toLowerCase()}</span>
        </summary>
        <ul>
          {(rules === 'ap' ? (AP_SPECIES_RULES[species] ?? info.rules) : info.rules).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <h4>Always</h4>
        <ul>
          {GENERAL_RULES[rules].map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="dim small">Following {RULEBOOK_NAME[rules]}.</p>
      </details>
    </section>
  )
}
