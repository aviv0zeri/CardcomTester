import type { Device, Language, Mode } from './CheckoutControls'

export type PreviewVersion = {
  id: string
  label: string
  note: string
  width: number
  height: number
  scroll: boolean
  embed: boolean
}

export function localPreviewUrl(
  language: Language,
  embed: boolean,
  design: 'old' | 'new',
) {
  const kind = embed ? `${language}/embed` : language
  const params = new URLSearchParams({
    v: `low-profile/${kind}`,
    wallets: '4',
  })
  if (design === 'new') params.set('brand', '1')
  return `/cardcom-preview/open.html?${params}`
}

const MOBILE_REDIRECT: PreviewVersion[] = [
  { id: 'm-redir', label: 'Phone page', note: '390×844', width: 390, height: 844, scroll: true, embed: false },
  { id: 'lp-redir', label: 'Large phone page', note: '430×932', width: 430, height: 932, scroll: true, embed: false },
  { id: 'tp-redir', label: 'Tablet page', note: '768×1024', width: 768, height: 1024, scroll: true, embed: false },
  { id: 'tl-redir', label: 'Tablet wide page', note: '1024×768', width: 1024, height: 768, scroll: true, embed: false },
]

const MOBILE_IFRAME: PreviewVersion[] = [
  { id: 'm-frame', label: 'Phone iframe', note: '390×700', width: 390, height: 700, scroll: true, embed: true },
  { id: 'lp-frame', label: 'Large phone iframe', note: '430×780', width: 430, height: 780, scroll: true, embed: true },
]

const DESKTOP_IFRAME: PreviewVersion[] = [
  { id: 'claude-land', label: 'Landscape', note: '1180×800', width: 1180, height: 800, scroll: false, embed: true },
  { id: 'claude-sq', label: 'Squarish', note: '900×720', width: 900, height: 720, scroll: false, embed: true },
  { id: 'claude-port', label: 'Portrait', note: '640×1080', width: 640, height: 1080, scroll: false, embed: true },
]

// Measured directly at 520px width (the real iframe width): full 4-wallet
// content is ~722px tall (header 138 + body 520 + footer 61). Do NOT
// re-derive this from the standalone/redirect page at a wide browser
// width — a viewport-width media query (600-1280px) changes that page's
// layout entirely, so it is not a fair comparison to the 520px iframe.
const NEW_DESKTOP_IFRAME: PreviewVersion[] = [
  { id: 'brand-frame', label: 'Checkout', note: '520×760', width: 520, height: 760, scroll: true, embed: true },
  { id: 'brand-tall', label: 'Tall', note: '520×850', width: 520, height: 850, scroll: true, embed: true },
]

export function versionsFor(device: Device, mode: Mode, design: 'old' | 'new' = 'old'): PreviewVersion[] {
  if (device === 'mobile') return [...MOBILE_REDIRECT, ...MOBILE_IFRAME]
  if (mode === 'redirect') return MOBILE_REDIRECT
  if (design === 'new') return NEW_DESKTOP_IFRAME
  return DESKTOP_IFRAME
}

export function isRealPhone(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.screen.width, window.screen.height) < 820
  return coarse && small
}
