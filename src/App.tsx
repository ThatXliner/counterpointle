import { useCallback, useEffect, useState } from 'react'
import { Game } from './components/Game'
import { Help } from './components/Help'
import { Home, shareDay } from './components/Home'
import type { Species } from './music/exercise'
import type { Level } from './music/generate'
import { currentDay, prefetchDay } from './puzzles'
import { loadSetting, saveSetting } from './storage'

type Route = { species: Species; level: Level } | null

function parseRoute(): Route {
  const m = location.hash.match(/^#\/([1-5])\/([1-5])$/)
  return m ? { species: Number(m[1]) as Species, level: Number(m[2]) as Level } : null
}

export function App() {
  const [day] = useState(currentDay)
  const [route, setRoute] = useState<Route>(parseRoute)
  const [help, setHelp] = useState(() => !loadSetting('seenHelp', false))
  const [showFigures, setShowFigures] = useState(() => loadSetting('figures', true))
  const [sound, setSound] = useState(() => loadSetting('sound', true))
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    const id = setTimeout(() => prefetchDay(day), 400)
    return () => clearTimeout(id)
  }, [day])
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

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareDay(day))
      setToastMsg('Copied to clipboard')
    } catch {
      setToastMsg('Could not copy. Your browser blocked the clipboard')
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <a className="wordmark" href="#" onClick={(e) => (e.preventDefault(), navigate(1, null))}>
          Counter<span>point</span>le
        </a>
        <div className="settings">
          <button className={`toggle ${showFigures ? 'on' : ''}`} onClick={() => setShowFigures((v) => !v)} aria-pressed={showFigures} title="Show interval numbers">
            5·6
          </button>
          <button className={`toggle ${sound ? 'on' : ''}`} onClick={() => setSound((v) => !v)} aria-pressed={sound} title="Sound when placing notes">
            ♪
          </button>
          <button className="toggle" onClick={() => setHelp(true)} title="How to play">
            ?
          </button>
        </div>
      </header>
      <main>
        {route ? (
          <Game
            day={day}
            species={route.species}
            level={route.level}
            showFigures={showFigures}
            sound={sound}
            toast={setToastMsg}
            onNavigate={navigate}
          />
        ) : (
          <Home day={day} onOpen={navigate} onShare={share} onHelp={() => setHelp(true)} />
        )}
      </main>
      <footer className="dim small">
        Rules after Fux, <em>Gradus ad Parnassum</em> (1725) ·{' '}
        <a href="https://github.com/ThatXliner/counterpointle">Source</a>
      </footer>
      <Help open={help} onClose={closeHelp} />
      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status">
        {toastMsg}
      </div>
    </div>
  )
}
