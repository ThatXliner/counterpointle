import { useEffect, useRef } from 'react'
import { MAX_CHECKS, SITE_RULES } from '../puzzles'

export function Help({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="help" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="help-body">
        <button className="close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>How to play</h2>
        <p>
          Fill in the missing notes of the counterpoint against the <em>cantus firmus</em> (the whole notes). Any line that
          breaks no rules wins. You have {MAX_CHECKS} checks.
        </p>
        <ul className="legend">
          <li>
            <span className="sq mark-ok" />
            <span>Fine</span>
          </li>
          <li>
            <span className="sq mark-melodic" />
            <span>Bad melody (leaps, repeats, range)</span>
          </li>
          <li>
            <span className="sq mark-harmonic" />
            <span>Bad harmony (dissonance, parallels)</span>
          </li>
        </ul>
        <p>Tap a blank to place a note, drag to move it. Arrow keys work too.</p>
        <p className="help-foot">
          {SITE_RULES === 'ap' ? (
            <>
              Rules from AP Music Theory. Want strict Fux in all five species? <a href="/">Play Counterpointle</a>.
            </>
          ) : (
            <>
              Rules after Fux's <em>Gradus ad Parnassum</em>. Studying for the exam? Try <a href="/ap">Counterpointle AP</a>.
            </>
          )}
        </p>
      </div>
    </dialog>
  )
}
