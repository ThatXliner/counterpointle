import { useCallback, useEffect, useState } from 'react'
import { Game } from './components/Game'
import { Help } from './components/Help'
import { Home, shareDay } from './components/Home'
import type { Species } from './music/exercise'
import type { Level } from './music/generate'
import { currentDay, prefetchDay } from './puzzles'
import { shareText } from './share'
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
  const [hard, setHard] = useState(() => loadSetting('hard', false))
  const [showFigures, setShowFigures] = useState(() => loadSetting('figures', true))
  const [sound, setSound] = useState(() => loadSetting('sound', true))
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    const id = setTimeout(() => prefetchDay(day, hard), 400)
    return () => clearTimeout(id)
  }, [day, hard])
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
        {route ? (
          <Game
            day={day}
            species={route.species}
            level={route.level}
            hard={hard}
            showFigures={showFigures}
            sound={sound}
            toast={setToastMsg}
            share={share}
            onNavigate={navigate}
          />
        ) : (
          <Home day={day} hard={hard} onHard={setHard} onOpen={navigate} onShare={() => share(shareDay(day, hard))} />
        )}
      </main>
      <footer className="dim small">
        Species I–II follow AP Music Theory voice leading; III–V follow Fux, <em>Gradus ad Parnassum</em> (1725).{' '}
        <a href="https://github.com/ThatXliner/counterpointle">Source</a>
      </footer>
      <Help open={help} onClose={closeHelp} />
      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status">
        {toastMsg}
      </div>
    </div>
  )
}
