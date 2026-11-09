import { ROMAN, SPECIES_INFO } from '../content'
import type { Species } from '../music/exercise'
import type { Level, Variant } from '../music/generate'
import { dayNumber, LEVELS, MAX_CHECKS, puzzleKey, siteUrl, speciesFor } from '../puzzles'
import { loadGame } from '../storage'

const KEYCAPS = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣']

function cellState(day: string, s: Species, l: Level, variant: Variant) {
  const g = loadGame(puzzleKey(day, s, l, variant))
  if (!g) return { kind: 'new' as const, tries: 0 }
  if (g.status === 'won') return { kind: 'won' as const, tries: g.attempts.length }
  if (g.status === 'lost') return { kind: 'lost' as const, tries: MAX_CHECKS }
  return { kind: g.attempts.length ? ('started' as const) : ('new' as const), tries: g.attempts.length }
}

/** "Counterpointle AP #1 · Hard mode ♯♭" */
export function gameTitle(day: string, { rules, hard }: Variant): string {
  return `Counterpointle${rules === 'ap' ? ' AP' : ''} #${dayNumber(day)}${hard ? ' · Hard mode ♯♭' : ''}`
}

export function shareDay(day: string, variant: Variant): string {
  const rows = speciesFor(variant).map((s) => {
    const cells = LEVELS.map((l) => {
      const c = cellState(day, s, l, variant)
      return c.kind === 'won' ? KEYCAPS[c.tries] : c.kind === 'lost' ? '❌' : '⬜'
    })
    return `${ROMAN[s].padEnd(3, ' ')} ${cells.join('')}`
  })
  return [gameTitle(day, variant), ...rows, siteUrl()].join('\n')
}

interface SegmentedProps<T extends string | boolean> {
  label: string
  value: T
  options: readonly (readonly [T, string, string?])[]
  onChange: (value: T) => void
}

function Segmented<T extends string | boolean>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, name, detail]) => (
        <button key={String(v)} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {name}
          {detail && <span className="dim"> · {detail}</span>}
        </button>
      ))}
    </div>
  )
}

interface HomeProps {
  day: string
  variant: Variant
  onHard: (hard: boolean) => void
  onOpen: (species: Species, level: Level) => void
  onShare: () => void
}

export function Home({ day, variant, onHard, onOpen, onShare }: HomeProps) {
  const species = speciesFor(variant)
  const cells = species.flatMap((s) => LEVELS.map((l) => cellState(day, s, l, variant)))
  const solved = cells.filter((c) => c.kind === 'won').length
  const date = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <section className="home">
      <div className="intro">
        <p className="eyebrow">
          No. {dayNumber(day)} · {date}
        </p>
        <p className="lede">
          Write the missing notes against the cantus firmus. Any line that breaks no rules wins. Level 1 leaves a few
          blanks; level 3 leaves the whole line to you.
        </p>
      </div>

      <div className="home-bar">
        <Segmented
          label="Key"
          value={variant.hard}
          options={[[false, 'C major'], [true, 'Hard', 'all keys & modes']]}
          onChange={onHard}
        />
        <button className={solved ? `primary${variant.hard ? ' gold' : ''}` : 'ghost-btn'} onClick={onShare} disabled={solved === 0}>
          Share · {solved}/{cells.length}
        </button>
      </div>

      <ol className="species-list">
        {species.map((s) => (
          <li key={s} className="species-row">
            <div className="species-label">
              <span className="numeral">{ROMAN[s]}</span>
              <span>{SPECIES_INFO[s].tagline}</span>
            </div>
            <div className="levels">
              {LEVELS.map((l) => {
                const c = cellState(day, s, l, variant)
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
      {variant.rules === 'ap' ? (
        <p className="dim small">
          This version follows the voice-leading conventions of the AP Music Theory course. The exam only asks you to write
          passing and neighbor tones, so it covers first and second species. <a href="/">Play strict Fux counterpoint →</a>
        </p>
      ) : (
        <p className="dim small">
          Taking AP Music Theory? <a href="/ap">Play the AP version →</a>
        </p>
      )}
    </section>
  )
}
