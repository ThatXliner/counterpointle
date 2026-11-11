import { useCallback, useEffect, useMemo, useState } from 'react'
import { Game } from './components/Game'
import { Help } from './components/Help'
import { Home, shareDay } from './components/Home'
import type { Species } from './music/exercise'
import type { Level, Variant } from './music/generate'
import { currentDay, prefetchDay, SITE_RULES, speciesFor } from './puzzles'
import { shareText } from './share'
import { loadSetting, saveSetting } from './storage'

type Route = { species: Species; level: Level } | null

function parseRoute(): Route {
  const m = location.hash.match(/^#\/([1-5])\/([1-3])$/)
  return m ? { species: Number(m[1]) as Species, level: Number(m[2]) as Level } : null
}

export function App() {
  const [day] = useState(currentDay)
  const [route, setRoute] = useState<Route>(parseRoute)
  const [help, setHelp] = useState(() => !loadSetting('seenHelp', false))
  const [hard, setHard] = useState(() => loadSetting('hard', false))
  const variant = useMemo<Variant>(() => ({ rules: SITE_RULES, hard }), [hard])
  const [showFigures, setShowFigures] = useState(() => loadSetting('figures', true))
  const [sound, setSound] = useState(() => loadSetting('sound', true))
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // A tab left open overnight should wake up on the new day's puzzles.
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && currentDay() !== day && location.reload()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [day])
  useEffect(() => {
    const id = setTimeout(() => prefetchDay(day, variant), 400)
    return () => clearTimeout(id)
  }, [day, variant])
  useEffect(() => saveSetting('hard', hard), [hard])
  useEffect(() => saveSetting('figures', showFigures), [showFigures])
  useEffect(() => saveSetting('sound', sound), [sound])
  useEffect(() => {
    if (!toastMsg) return
    const id = setTimeout(() => setToastMsg(null), 2200)
    return () => clearTimeout(id)
  }, [toastMsg])

  const navigate = useCallback((species: Species, level: Level | null) => {
    location.hash = level === null ? '' : `/${species}/${level}`
    window.scrollTo({ top: 0 })
  }, [])

  const closeHelp = () => {
    setHelp(false)
    saveSetting('seenHelp', true)
  }

  const share = async (text: string) => {
    const msg = await shareText(text)
    if (msg) setToastMsg(msg)
  }

  return (
    <div className="app">
      <header className="masthead">
        <a className="wordmark" href="#" onClick={(e) => (e.preventDefault(), navigate(1, null))}>
          Counter<span>point</span>le
          {SITE_RULES === 'ap' && <small>AP</small>}
        </a>
        <div className="settings">
          <button className={`icon-btn ${showFigures ? 'on' : ''}`} onClick={() => setShowFigures((v) => !v)} aria-pressed={showFigures} title="Interval numbers under the staff">
            5·6
          </button>
          <button className={`icon-btn ${sound ? 'on' : ''}`} onClick={() => setSound((v) => !v)} aria-pressed={sound} title="Sound when placing notes">
            ♪
          </button>
          <button className="icon-btn on" onClick={() => setHelp(true)} title="How to play">
            ?
          </button>
        </div>
      </header>
      <main>
        {route && speciesFor(variant).includes(route.species) ? (
          <Game
            day={day}
            species={route.species}
            level={route.level}
            variant={variant}
            showFigures={showFigures}
            sound={sound}
            toast={setToastMsg}
            share={share}
            onNavigate={navigate}
          />
        ) : (
          <Home
            day={day}
            variant={variant}
            onHard={setHard}
            onOpen={navigate}
            onShare={() => share(shareDay(day, variant))}
          />
        )}
      </main>
      <footer className="dim small">
        {SITE_RULES === 'ap' ? (
          <>Rules after the AP Music Theory Course and Exam Description. </>
        ) : (
          <>
            Rules after Fux, <em>Gradus ad Parnassum</em> (1725).{' '}
          </>
        )}
        <a href="https://github.com/ThatXliner/counterpointle">Source</a>
      </footer>
      <Help open={help} onClose={closeHelp} />
      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status">
        {toastMsg}
      </div>
    </div>
  )
}
