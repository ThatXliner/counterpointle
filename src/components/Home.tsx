import { ROMAN, SPECIES_INFO } from '../content'
import type { Species } from '../music/exercise'
import type { Level } from '../music/generate'
import { dayNumber, LEVELS, MAX_CHECKS, puzzleKey, SPECIES } from '../puzzles'
import { loadGame } from '../storage'

const KEYCAPS = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣']

function cellState(day: string, s: Species, l: Level) {
  const g = loadGame(puzzleKey(day, s, l))
  if (!g) return { kind: 'new' as const, tries: 0 }
  if (g.status === 'won') return { kind: 'won' as const, tries: g.attempts.length }
  if (g.status === 'lost') return { kind: 'lost' as const, tries: MAX_CHECKS }
  return { kind: g.attempts.length ? ('started' as const) : ('new' as const), tries: g.attempts.length }
}

export function shareDay(day: string): string {
  const rows = SPECIES.map((s) => {
    const cells = LEVELS.map((l) => {
      const c = cellState(day, s, l)
      return c.kind === 'won' ? KEYCAPS[c.tries] : c.kind === 'lost' ? '❌' : '⬜'
    })
    return `${ROMAN[s].padEnd(3, ' ')} ${cells.join('')}`
  })
  return [`Counterpointle #${dayNumber(day)}`, ...rows, location.origin].join('\n')
}

interface HomeProps {
  day: string
  onOpen: (species: Species, level: Level) => void
  onShare: () => void
  onHelp: () => void
}

export function Home({ day, onOpen, onShare, onHelp }: HomeProps) {
  const solved = SPECIES.flatMap((s) => LEVELS.map((l) => cellState(day, s, l))).filter((c) => c.kind === 'won').length
  const date = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <section className="home">
      <div className="intro">
        <p className="eyebrow">
          No. {dayNumber(day)} · {date}
        </p>
        <p className="lede">
          Finish the counterpoint. Each puzzle gives you a cantus firmus and part of a line above or below it. Fill in the
          blanks so nothing breaks the rules of strict style. Any correct answer counts, and you get {MAX_CHECKS} checks.
        </p>
        <div className="row">
          <button className="ghost-btn" onClick={onHelp}>
            How to play
          </button>
          <button className="ghost-btn" onClick={onShare} disabled={solved === 0}>
            Share today · {solved}/25
          </button>
        </div>
      </div>

      <ol className="species-list">
        {SPECIES.map((s) => (
          <li key={s} className="species-row">
            <div className="species-label">
              <span className="numeral">{ROMAN[s]}</span>
              <span>
                <strong>{SPECIES_INFO[s].tagline}</strong>
                <span className="dim">{SPECIES_INFO[s].name}</span>
              </span>
            </div>
            <div className="levels">
              {LEVELS.map((l) => {
                const c = cellState(day, s, l)
                return (
                  <button
                    key={l}
                    className={`level ${c.kind}`}
                    onClick={() => onOpen(s, l)}
                    aria-label={`Species ${s}, level ${l}: ${c.kind === 'won' ? `solved in ${c.tries}` : c.kind}`}
                  >
                    <span className="lv">{l}</span>
                    {c.kind === 'won' && <span className="tag">{c.tries}/{MAX_CHECKS}</span>}
                    {c.kind === 'lost' && <span className="tag">✕</span>}
                    {c.kind === 'started' && <span className="tag">…</span>}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
      <p className="dim small">Level 1 leaves a few blanks. Level 5 leaves the whole line to you. New puzzles every day at midnight.</p>
    </section>
  )
}
