// Tiny UI sound effects -- synthesized with the Web Audio API (short sine/
// sawtooth blips), not audio files. No asset pipeline, no licensing, nothing
// to fetch: every "sound" here is a few oscillator envelopes generated on
// the fly. Muted by default is wrong for a demo tool people click through
// out loud, so the default is on; loadSfxMuted/saveSfxMuted persist an
// explicit opt-out the same way uiLang persists the language choice.

const KEY = 'guided-sfx-muted'

export function loadSfxMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveSfxMuted(muted: boolean) {
  try {
    window.localStorage.setItem(KEY, muted ? '1' : '0')
  } catch {
    // Private windows can reject storage -- the toggle still works this tab.
  }
}

let muted = loadSfxMuted()

export function setSfxMuted(value: boolean) {
  muted = value
}

export function isSfxMuted(): boolean {
  return muted
}

type AudioCtor = typeof AudioContext

function windowAudioCtor(): AudioCtor | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
}

let ctx: AudioContext | null = null

// Browsers suspend a freshly-created AudioContext until a user gesture --
// every call site here is already inside a click handler, so resume() is
// safe to fire-and-forget on every play rather than tracked separately.
function sharedCtx(): AudioContext | null {
  const Ctor = windowAudioCtor()
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  audio: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peakGain: number,
  type: OscillatorType,
) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  const start = audio.currentTime + startOffset
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function play(notes: [freq: number, startOffset: number, duration: number, peakGain: number, type?: OscillatorType][]) {
  if (muted) return
  const audio = sharedCtx()
  if (!audio) return
  for (const [freq, startOffset, duration, peakGain, type] of notes) {
    tone(audio, freq, startOffset, duration, peakGain, type ?? 'sine')
  }
}

// A light tick -- picking a choice, copying the card number.
export function playClick() {
  play([[720, 0, 0.06, 0.05]])
}

// Two rising notes -- moving to the next step.
export function playStep() {
  play([
    [520, 0, 0.09, 0.045],
    [760, 0.05, 0.11, 0.04],
  ])
}

// Three rising notes -- the run reached "done".
export function playSuccess() {
  play([
    [660, 0, 0.12, 0.05],
    [880, 0.09, 0.16, 0.05],
    [1108, 0.18, 0.24, 0.045],
  ])
}

// A dull two-note buzz -- Cardcom/Spectra returned an error.
export function playError() {
  play([
    [220, 0, 0.16, 0.05, 'sawtooth'],
    [174, 0.1, 0.2, 0.045, 'sawtooth'],
  ])
}
