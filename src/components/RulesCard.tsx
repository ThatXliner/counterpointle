import { AP_SPECIES_RULES, GENERAL_RULES, RULEBOOK_NAME, SPECIES_INFO } from '../content'
import type { Species } from '../music/exercise'
import type { Rulebook } from '../music/rules'

export function RulesCard({ rules, species }: { rules: Rulebook; species: Species }) {
  const info = SPECIES_INFO[species]
  return (
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
  )
}
