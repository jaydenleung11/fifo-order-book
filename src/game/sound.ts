/**
 * Tiny synthesized sound cues (no audio files). Every cue is a couple of
 * oscillator notes, so the game has a voice without downloads.
 */
let ctx: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem('ftr-muted') === '1'
  } catch {
    return false
  }
}

export function isMuted() {
  return muted
}

export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem('ftr-muted', m ? '1' : '0')
  } catch {
    /* storage can be blocked; the toggle still works for this visit */
  }
}

function audio(): AudioContext | null {
  if (muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function note(freq: number, start: number, dur: number, type: OscillatorType = 'triangle', vol = 0.12) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const sfx = {
  /** Someone joins the back of the line. */
  join: () => note(520, 0, 0.09, 'sine', 0.05),
  /** An item comes off the stove. */
  ready: () => note(1320, 0, 0.06, 'sine', 0.03),
  /** Correct serve; the pitch climbs with the combo. */
  serve: (combo: number) => {
    const base = 660 * Math.pow(2, Math.min(combo, 12) / 12)
    note(base, 0, 0.12)
    note(base * 1.5, 0.07, 0.16)
  },
  /** Served out of order. */
  wrong: () => {
    note(180, 0, 0.18, 'square', 0.06)
    note(140, 0.12, 0.22, 'square', 0.06)
  },
  /** Level finished. */
  done: () => [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.22)),
  /** Pressed Serve with nothing ready. */
  nope: () => note(240, 0, 0.08, 'sine', 0.05),
}
