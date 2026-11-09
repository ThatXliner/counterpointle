import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement } from 'react'
import { BAR, cfPitch, cpPitch, type Context } from '../music/exercise'
import { intervalBetween, keyAlter, letterOf } from '../music/theory'
import type { Mark } from '../storage'

type StaffName = 'treble' | 'bass'

const HALF = 5 // px per diatonic step
const TOP = { treble: 50, bass: 150 } // y of each staff's top line
const TOP_STEP = { treble: 38, bass: 26 } // F5 and A3
const MIDDLE_STEP = { treble: 34, bass: 22 } // B4 and D3
const HEIGHT = 236
const FIGURE_Y = 224
const PAD = 20
const CLEF_W = 54
const SIG_W = 9 // px per sharp or flat in the key signature
/** Where each sharp and flat of a key signature sits on the treble staff; the bass staff is two octaves lower. */
const SIG_STEPS = { sharp: [38, 35, 39, 36, 33, 37, 34], flat: [34, 37, 33, 36, 32, 35, 31] }
const GLYPH: Record<number, string> = { [-1]: '♭', 0: '♮', 1: '♯' }
/** Preferred zoom; scores shrink toward 1 to fit their card before they scroll. */
const MAX_SCALE = 1.3

const yOf = (step: number, staff: StaffName) => TOP[staff] + (TOP_STEP[staff] - step) * HALF
const stepAt = (y: number, staff: StaffName) => Math.round(TOP_STEP[staff] - (y - TOP[staff]) / HALF)

function ledgers(step: number, staff: StaffName): number[] {
  const top = TOP_STEP[staff]
  const bottom = top - 8
  const out: number[] = []
  for (let s = top + 2; s <= step; s += 2) out.push(s)
  for (let s = bottom - 2; s >= step; s -= 2) out.push(s)
  return out
}

/** One drawn notehead. A note tied over the barline is two segments. */
interface Segment {
  slot: number
  time: number
  dur: number
  tieNext: boolean
}

function segmentsOf(ctx: Context): Segment[] {
  return ctx.slots.flatMap((s, slot) => {
    if (!s.tiesOver) return [{ slot, time: s.start, dur: s.dur, tieNext: false }]
    const first = BAR - s.offset
    return [
      { slot, time: s.start, dur: first, tieNext: true },
      { slot, time: (s.bar + 1) * BAR, dur: s.dur - first, tieNext: false },
    ]
  })
}

export interface Layout {
  width: number
  barX: number[]
  barW: number[]
  x: (time: number) => number
}

export function layoutFor(ctx: Context, segments: Segment[]): Layout {
  const barW: number[] = []
  const barX: number[] = []
  const sig = Math.abs(ctx.ex.key.sig)
  let cursor = CLEF_W + (sig ? sig * SIG_W + 6 : 0)
  for (let b = 0; b < ctx.bars; b++) {
    const durs = segments.filter((g) => Math.floor(g.time / BAR) === b).map((g) => g.dur)
    if (b === 0 && ctx.slots[0].start > 0) durs.push(ctx.slots[0].start)
    const shortest = Math.min(8, ...durs)
    const w = Math.max(74, 2 * PAD + (26 * BAR) / shortest) + (b === ctx.bars - 2 ? 12 : 0)
    barX.push(cursor)
    barW.push(w)
    cursor += w
  }
  const x = (time: number) => {
    const b = Math.min(Math.floor(time / BAR), ctx.bars - 1)
    return barX[b] + PAD + ((time - b * BAR) / BAR) * (barW[b] - 2 * PAD)
  }
  return { width: cursor + 8, barX, barW, x }
}

interface HeadProps {
  x: number
  y: number
  dur: number
  stem: 'up' | 'down' | null
  className: string
  dashed?: boolean
}

function Head({ x, y, dur, stem, className, dashed }: HeadProps) {
  if (dashed)
    return (
      <g className={`${className}${dur < 4 ? ' short' : ''}`}>
        <ellipse cx={x} cy={y} rx={6.4} ry={4.4} transform={`rotate(-22 ${x} ${y})`} />
        {dur < 8 && <line x1={x + 6} y1={y - 1} x2={x + 6} y2={y - 30} />}
      </g>
    )
  return (
    <g className={className}>
      {dur >= 8 ? (
        <>
          <ellipse cx={x} cy={y} rx={7.6} ry={4.9} />
          <ellipse className="hole" cx={x} cy={y} rx={3.2} ry={2.4} transform={`rotate(-50 ${x} ${y})`} />
        </>
      ) : (
        <>
          <ellipse cx={x} cy={y} rx={6.3} ry={4.4} transform={`rotate(-22 ${x} ${y})`} />
          {dur >= 4 && <ellipse className="hole" cx={x} cy={y} rx={4.4} ry={1.7} transform={`rotate(-22 ${x} ${y})`} />}
        </>
      )}
      {stem === 'up' && <line className="stem" x1={x + 5.7} y1={y - 1} x2={x + 5.7} y2={y - 34} />}
      {stem === 'down' && <line className="stem" x1={x - 5.7} y1={y + 1} x2={x - 5.7} y2={y + 34} />}
    </g>
  )
}

export interface StaffProps {
  ctx: Context
  notes: readonly (number | null)[]
  given: readonly (number | null)[]
  marks: readonly (Mark | null)[]
  selected: number | null
  editable: boolean
  showFigures: boolean
  highlight: readonly number[]
  /** Playhead position in eighth notes, or null when stopped. */
  playTime: number | null
  onPick: (slot: number, step: number) => void
}

export function Staff({ ctx, notes, given, marks, selected, editable, showFigures, highlight, playTime, onPick }: StaffProps) {
  const segments = useMemo(() => segmentsOf(ctx), [ctx])
  // An accidental shows when a note differs from the key signature, or from an earlier note in the same bar.
  const accidentals = useMemo(() => {
    const out = new Map<number, string>()
    let bar = -1
    let current = new Map<number, number>()
    ctx.slots.forEach((s, i) => {
      if (notes[i] == null) return
      if (s.bar !== bar) [bar, current] = [s.bar, new Map()]
      const { step, alter } = cpPitch(ctx, i, notes[i]!)
      if (alter !== (current.get(step) ?? keyAlter(letterOf(step), ctx.ex.key.sig))) out.set(i, GLYPH[alter])
      current.set(step, alter)
    })
    return out
  }, [ctx, notes])
  const layout = useMemo(() => layoutFor(ctx, segments), [ctx, segments])
  const svgRef = useRef<SVGSVGElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const [hover, setHover] = useState<{ slot: number; step: number } | null>(null)
  const [available, setAvailable] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setAvailable(el.clientWidth - 16))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const scale = available ? Math.min(MAX_SCALE, Math.max(1, available / layout.width)) : MAX_SCALE

  const cpStaff: StaffName = ctx.ex.cpAbove ? 'treble' : 'bass'
  const cfStaff: StaffName = ctx.ex.cpAbove ? 'bass' : 'treble'
  const [lo, hi] = ctx.range
  const { x } = layout

  useEffect(() => {
    const el = scrollRef.current
    if (selected === null || !el) return
    const px = x(ctx.slots[selected].start) * scale
    if (px < el.scrollLeft + 40 || px > el.scrollLeft + el.clientWidth - 40)
      el.scrollTo({ left: px - el.clientWidth / 2, behavior: 'smooth' })
  }, [selected, ctx, x, scale])

  const stepFromEvent = (e: PointerEvent): number => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const local = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return Math.min(hi, Math.max(lo, stepAt(local.y, cpStaff)))
  }

  const stemFor = (step: number, staff: StaffName, dur: number): 'up' | 'down' | null =>
    dur >= 8 ? null : step >= MIDDLE_STEP[staff] ? 'down' : 'up'

  const noteClass = (slot: number) => {
    if (given[slot] !== null) return highlight.includes(slot) ? 'note given flagged' : 'note given'
    const mark = marks[slot]
    return `note user${mark ? ` mark-${mark}` : ''}${highlight.includes(slot) ? ' flagged' : ''}`
  }

  const staffLines = (staff: StaffName) =>
    [0, 1, 2, 3, 4].map((k) => (
      <line key={`${staff}${k}`} className="staff-line" x1={4} x2={layout.width - 6} y1={TOP[staff] + k * 2 * HALF} y2={TOP[staff] + k * 2 * HALF} />
    ))

  const ledgerLines = (cx: number, step: number, staff: StaffName, key: string) =>
    ledgers(step, staff).map((s) => <line key={`${key}l${s}`} className="ledger" x1={cx - 10} x2={cx + 10} y1={yOf(s, staff)} y2={yOf(s, staff)} />)

  // Eighth notes come in pairs and share a beam.
  const beamed = new Set<number>()
  const beams: ReactElement[] = []
  ctx.slots.forEach((s, i) => {
    const next = ctx.slots[i + 1]
    if (s.dur !== 1 || next?.dur !== 1 || beamed.has(i) || notes[i] == null || notes[i + 1] == null) return
    beamed.add(i).add(i + 1)
    const [a, b] = [notes[i]!, notes[i + 1]!]
    const up = (a + b) / 2 < MIDDLE_STEP[cpStaff]
    const [xa, xb] = [x(s.start), x(next.start)].map((v) => v + (up ? 5.7 : -5.7))
    const [ya, yb] = [yOf(a, cpStaff), yOf(b, cpStaff)]
    const end = up ? Math.min(ya, yb) - 30 : Math.max(ya, yb) + 30
    beams.push(
      <g key={`beam${i}`} className={noteClass(i)}>
        <line className="stem" x1={xa} y1={ya} x2={xa} y2={end} />
        <line className="stem" x1={xb} y1={yb} x2={xb} y2={end} />
        <rect x={xa - 0.6} y={up ? end : end - 4.5} width={xb - xa + 1.2} height={4.5} />
      </g>,
    )
  })

  const figures = showFigures
    ? ctx.moments.flatMap((m) => {
        if (m.slot < 0 || notes[m.slot] == null) return []
        const iv = intervalBetween(cpPitch(ctx, m.slot, notes[m.slot]!), cfPitch(ctx, m.bar))
        return [
          <text key={`f${m.time}`} className={`figure${iv.consonance === 'dissonant' ? ' dissonant' : ''}`} x={x(m.time)} y={FIGURE_Y} textAnchor="middle">
            {iv.size + 1}
          </text>,
        ]
      })
    : []

  const restTime = ctx.slots[0].start
  const mid = yOf(MIDDLE_STEP[cpStaff], cpStaff)

  return (
    <div className="staff-scroll" ref={scrollRef}>
      <svg
        ref={svgRef}
        className="staff"
        viewBox={`0 0 ${layout.width} ${HEIGHT}`}
        width={layout.width * scale}
        height={HEIGHT * scale}
        role="img"
        aria-label="Score: cantus firmus and counterpoint"
        onPointerLeave={() => setHover(null)}
      >
        {selected !== null &&
          segments
            .filter((g) => g.slot === selected)
            .map((g) => <rect key={`sel${g.time}`} className="selection" x={x(g.time) - 14} y={20} width={28} height={HEIGHT - 34} rx={8} />)}

        {staffLines('treble')}
        {staffLines('bass')}
        <line className="barline" x1={4} x2={4} y1={TOP.treble} y2={TOP.bass + 40} />
        <text className="clef" x={10} y={yOf(32, 'treble') + 10}>𝄞</text>
        <text className="clef" x={10} y={yOf(24, 'bass') + 27}>𝄢</text>
        {(['treble', 'bass'] as const).flatMap((staff) => {
          const { sig } = ctx.ex.key
          const steps = (sig > 0 ? SIG_STEPS.sharp : SIG_STEPS.flat).slice(0, Math.abs(sig))
          return steps.map((step, k) => (
            <text key={`${staff}sig${k}`} className="accidental keysig" x={CLEF_W - 6 + k * SIG_W} y={yOf(staff === 'treble' ? step : step - 14, staff) + 5}>
              {sig > 0 ? '♯' : '♭'}
            </text>
          ))
        })}
        {layout.barX.map((bx, b) => (
          <text key={`n${b}`} className="bar-number" x={bx + 3} y={TOP.treble - 26}>
            {b + 1}
          </text>
        ))}
        {layout.barX.map((bx, b) => {
          const end = bx + layout.barW[b]
          const final = b === ctx.bars - 1
          return (
            <g key={`b${b}`}>
              <line className="barline" x1={final ? end - 10 : end} x2={final ? end - 10 : end} y1={TOP.treble} y2={TOP.bass + 40} />
              {final && <rect className="barline-heavy" x={end - 6} y={TOP.treble} width={4} height={TOP.bass + 40 - TOP.treble} />}
            </g>
          )
        })}

        {/* Cantus firmus */}
        {ctx.ex.cf.map((step, b) => {
          const cx = x(b * BAR)
          return (
            <g key={`cf${b}`}>
              {ledgerLines(cx, step, cfStaff, `cf${b}`)}
              <Head x={cx} y={yOf(step, cfStaff)} dur={8} stem={null} className="note cantus" />
            </g>
          )
        })}

        {restTime > 0 && <rect className="rest" x={x(0) - 6} y={mid - 5} width={12} height={5} />}

        {/* Counterpoint */}
        {segments.map((g, k) => {
          const step = notes[g.slot]
          const cx = x(g.time)
          if (step == null) {
            const isSel = g.slot === selected
            return <Head key={`g${k}`} x={cx} y={mid} dur={g.dur} stem={null} dashed className={`ghost${isSel ? ' active' : ''}`} />
          }
          const y = yOf(step, cpStaff)
          const stem = beamed.has(g.slot) ? null : stemFor(step, cpStaff, g.dur)
          const second = g.time !== ctx.slots[g.slot].start
          const nextSeg = segments[k + 1]
          return (
            <g key={`n${k}`}>
              {ledgerLines(cx, step, cpStaff, `n${k}`)}
              {accidentals.has(g.slot) && !second && (
                <text className={`accidental ${noteClass(g.slot)}`} x={cx - 17} y={y + 5}>
                  {accidentals.get(g.slot)}
                </text>
              )}
              <Head x={cx} y={y} dur={g.dur} stem={stem} className={noteClass(g.slot)} />
              {g.dur === 1 && !beamed.has(g.slot) && stem && (
                <path className={`flag ${noteClass(g.slot)}`} d={stem === 'up' ? `M${cx + 5.7} ${y - 34} q2 9 9 14 q-3 -5 -9 -8` : `M${cx - 5.7} ${y + 34} q2 -9 9 -14 q-3 5 -9 8`} />
              )}
              {g.tieNext && nextSeg && (
                <path
                  className={`tie ${noteClass(g.slot)}`}
                  d={(() => {
                    const x2 = x(nextSeg.time)
                    const dir = stem === 'up' ? 1 : -1
                    const y0 = y + dir * 6
                    return `M${cx + 6} ${y0} Q${(cx + x2) / 2} ${y0 + dir * 11} ${x2 - 6} ${y0} Q${(cx + x2) / 2} ${y0 + dir * 8} ${cx + 6} ${y0}`
                  })()}
                />
              )}
            </g>
          )
        })}
        {beams}

        {hover && notes[hover.slot] !== hover.step &&
          segments
            .filter((g) => g.slot === hover.slot)
            .map((g) => (
              <g key={`h${g.time}`} className="preview">
                {ledgerLines(x(g.time), hover.step, cpStaff, `h${g.time}`)}
                <Head x={x(g.time)} y={yOf(hover.step, cpStaff)} dur={g.dur} stem={null} className="note" />
              </g>
            ))}

        {figures}

        {playTime !== null && <line className="playhead" x1={x(playTime)} x2={x(playTime)} y1={24} y2={HEIGHT - 20} />}

        {/* Hit areas for writable notes */}
        {editable &&
          segments.map((g, k) => {
            if (given[g.slot] !== null) return null
            const cx = x(g.time)
            const gaps = [segments[k - 1], segments[k + 1]].filter(Boolean).map((o) => Math.abs(x(o!.time) - cx))
            const w = Math.min(36, Math.max(18, Math.min(...gaps, 36)))
            const top = yOf(hi, cpStaff) - 8
            return (
              <rect
                key={`hit${k}`}
                className="hit"
                x={cx - w / 2}
                y={top}
                width={w}
                height={yOf(lo, cpStaff) + 8 - top}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  dragging.current = g.slot
                  onPick(g.slot, stepFromEvent(e))
                }}
                onPointerMove={(e) => {
                  const step = stepFromEvent(e)
                  if (dragging.current === g.slot) {
                    if (notes[g.slot] !== step) onPick(g.slot, step)
                  } else if (e.pointerType === 'mouse') setHover({ slot: g.slot, step })
                }}
                onPointerUp={() => (dragging.current = null)}
                onPointerLeave={() => setHover(null)}
              />
            )
          })}
      </svg>
    </div>
  )
}
