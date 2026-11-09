import { ROMAN, SPECIES_INFO } from '../content'
import type { Species } from '../music/exercise'
import type { Level } from '../music/generate'
import { dayNumber, LEVELS, MAX_CHECKS, puzzleKey, SPECIES } from '../puzzles'
import { loadGame } from '../storage'

const KEYCAPS = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣']

function cellState(day: string, s: Species, l: Level, hard: boolean) {
  const g = loadGame(puzzleKey(day, s, l, hard))
  if (!g) return { kind: 'new' as const, tries: 0 }
  if (g.status === 'won') return { kind: 'won' as const, tries: g.attempts.length }
  if (g.status === 'lost') return { kind: 'lost' as const, tries: MAX_CHECKS }
  return { kind: g.attempts.length ? ('started' as const) : ('new' as const), tries: g.attempts.length }
}

export function shareDay(day: string, hard: boolean): string {
  const rows = SPECIES.map((s) => {
    const cells = LEVELS.map((l) => {
      const c = cellState(day, s, l, hard)
      return c.kind === 'won' ? KEYCAPS[c.tries] : c.kind === 'lost' ? '❌' : '⬜'
    })
    return `${ROMAN[s].padEnd(3, ' ')} ${cells.join('')}`
  })
  return [`Counterpointle #${dayNumber(day)}${hard ? ' · Hard' : ''}`, ...rows, location.origin].join('\n')
}

interface HomeProps {
  day: string
  hard: boolean
  onHard: (hard: boolean) => void
  onOpen: (species: Species, level: Level) => void
  onShare: () => void
}

export function Home({ day, hard, onHard, onOpen, onShare }: HomeProps) {
  const solved = SPECIES.flatMap((s) => LEVELS.map((l) => cellState(day, s, l, hard))).filter((c) => c.kind === 'won').length
  const date = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <section className="home">
      <div className="intro">
        <p className="eyebrow">
          No. {dayNumber(day)} · {date}
        </p>
        <p className="lede">
          Write the missing notes against the cantus firmus. Any line that breaks no rules wins. Level 1 leaves a few
          blanks; level 5 leaves the whole line to you.
        </p>
      </div>

      <div className="home-bar">
        <div className="segmented" role="radiogroup" aria-label="Difficulty">
          <button role="radio" aria-checked={!hard} className={hard ? '' : 'on'} onClick={() => onHard(false)}>
            C major
          </button>
          <button role="radio" aria-checked={hard} className={hard ? 'on' : ''} onClick={() => onHard(true)}>
            Hard <span className="dim">· all keys &amp; modes</span>
          </button>
        </div>
        <button className={solved ? 'primary' : 'ghost-btn'} onClick={onShare} disabled={solved === 0}>
          Share · {solved}/25
        </button>
      </div>

      <ol className="species-list">
        {SPECIES.map((s) => (
          <li key={s} className="species-row">
            <div className="species-label">
              <span className="numeral">{ROMAN[s]}</span>
              <span>{SPECIES_INFO[s].tagline}</span>
            </div>
            <div className="levels">
              {LEVELS.map((l) => {
                const c = cellState(day, s, l, hard)
                return (
                  <button
                    key={l}
                    className={`level ${c.kind}`}
                    onClick={() => onOpen(s, l)}
                    aria-label={`Species ${s}, level ${l}: ${c.kind === 'won' ? `solved in ${c.tries}` : c.kind}`}
                  >
                    {l}
                    {c.kind === 'won' && <span className="tag">{c.tries}/{MAX_CHECKS}</span>}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
