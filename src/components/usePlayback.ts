import { useEffect, useRef, useState } from 'react'
import { play, type Tone } from '../audio'
import { BAR, cfPitch, cpPitch, type Context } from '../music/exercise'
import { midi } from '../music/theory'

export const EIGHTH_SECONDS = 0.17

function tonesFor(ctx: Context, notes: readonly (number | null)[]): Tone[] {
  const cf = ctx.ex.cf.map((_, b) => ({ midi: midi(cfPitch(ctx, b)), at: b * BAR * EIGHTH_SECONDS, dur: BAR * EIGHTH_SECONDS }))
  const cp = ctx.slots.flatMap((s, i) =>
    notes[i] == null ? [] : [{ midi: midi(cpPitch(ctx, i, notes[i]!)), at: s.start * EIGHTH_SECONDS, dur: s.dur * EIGHTH_SECONDS }],
  )
  return [...cf, ...cp]
}

/** Plays both voices with a moving playhead; `playTime` is in eighth notes, or null when stopped. */
export function usePlayback(ctx: Context, notes: readonly (number | null)[]) {
  const [playTime, setPlayTime] = useState<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  useEffect(() => () => stopRef.current?.(), [])

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
  return { playTime, togglePlay }
}
