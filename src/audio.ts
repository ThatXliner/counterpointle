let audio: AudioContext | null = null

function ctx(): AudioContext {
  audio ??= new AudioContext()
  if (audio.state === 'suspended') void audio.resume()
  return audio
}

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** A soft organ-ish tone: two detuned oscillators through a lowpass, with a gentle envelope. */
function voice(midi: number, at: number, dur: number, level: number, out: AudioNode) {
  const ac = ctx()
  const gain = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2200
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(level, at + 0.025)
  gain.gain.setTargetAtTime(level * 0.65, at + 0.03, 0.25)
  gain.gain.setTargetAtTime(0, at + Math.max(dur - 0.06, 0.04), 0.05)
  for (const [type, detune] of [['triangle', -4], ['sine', 4]] as const) {
    const osc = ac.createOscillator()
    osc.type = type
    osc.frequency.value = freq(midi)
    osc.detune.value = detune
    osc.connect(filter)
    osc.start(at)
    osc.stop(at + dur + 0.4)
  }
  filter.connect(gain).connect(out)
}

export interface Tone {
  midi: number
  /** Seconds from the start. */
  at: number
  dur: number
}

/** Plays tones and returns a stop function plus the AudioContext start time for a playhead. */
export function play(tones: Tone[]): { stop: () => void; startedAt: number; now: () => number } {
  const ac = ctx()
  const bus = ac.createGain()
  bus.gain.value = 0.9
  bus.connect(ac.destination)
  const t0 = ac.currentTime + 0.05
  for (const t of tones) voice(t.midi, t0 + t.at, t.dur, 0.16, bus)
  return {
    startedAt: t0,
    now: () => ac.currentTime - t0,
    stop: () => {
      bus.gain.setTargetAtTime(0, ac.currentTime, 0.03)
      setTimeout(() => bus.disconnect(), 300)
    },
  }
}
