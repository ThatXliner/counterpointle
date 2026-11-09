import { useEffect, useRef } from 'react'
import { MAX_CHECKS } from '../puzzles'

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
          Every day brings three levels for each species of counterpoint. Each puzzle gives you a{' '}
          <em>cantus firmus</em> (the whole notes) and a counterpoint line with some notes missing. Write the missing notes.
        </p>
        <p>
          Like a sudoku, there's a rulebook. Unlike a sudoku, there's usually more than one right answer. Any line that breaks
          no rules wins. You have {MAX_CHECKS} checks.
        </p>
        <h3>After each check</h3>
        <ul className="legend">
          <li>
            <span className="sq mark-ok" /> The note is fine.
          </li>
          <li>
            <span className="sq mark-melodic" /> It breaks a <strong>melodic</strong> rule: the shape of your line (bad leap,
            repeated note, range).
          </li>
          <li>
            <span className="sq mark-harmonic" /> It breaks a <strong>harmonic</strong> rule against the cantus (dissonance,
            parallel fifths, hidden octaves…).
          </li>
        </ul>
        <p>The list under the score names each broken rule and its bar. Hover or tap one to see the notes involved.</p>
        <h3>Writing notes</h3>
        <ul>
          <li>Tap a dashed blank on the staff where you want the note. Drag up or down to adjust.</li>
          <li>On a keyboard: ← → pick a blank, ↑ ↓ move it (Shift jumps an octave), Delete erases, Enter checks, Space plays.</li>
          <li>The numbers under the staff are the intervals against the cantus. Turn them off with the 5·6 button for an extra challenge.</li>
        </ul>
        <h3>Two versions</h3>
        <p>
          This site plays strict species counterpoint after Fux's <em>Gradus ad Parnassum</em> (1725), in all five species.{' '}
          <a href="/ap">Counterpointle AP</a> uses the voice-leading rules of the AP Music Theory course instead: looser
          about hidden fifths, strict about the leading tone, and only first and second species, the part of counterpoint
          the exam asks you to write.
        </p>
        <p>
          Puzzles are in C major. <strong>Hard</strong> is a separate set in other keys and in the Dorian, Mixolydian and
          minor modes. There the leading tone is raised for you in the second-to-last bar. Each puzzle lists its rules under
          the score.
        </p>
      </div>
    </dialog>
  )
}
