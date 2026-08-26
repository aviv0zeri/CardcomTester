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
  { id: 'm-redir', label: 'Phone', note: '390×844', width: 390, height: 844, scroll: true, embed: false },
  { id: 'lp-redir', label: 'Large phone', note: '430×932', width: 430, height: 932, scroll: true, embed: false },
  { id: 'tp-redir', label: 'Tablet', note: '768×1024', width: 768, height: 1024, scroll: true, embed: false },
  { id: 'tl-redir', label: 'Tablet wide', note: '1024×768', width: 1024, height: 768, scroll: true, embed: false },
]

const DESKTOP_IFRAME: PreviewVersion[] = [
  { id: 'claude-land', label: 'Landscape', note: '1180×800', width: 1180, height: 800, scroll: false, embed: true },
  { id: 'claude-sq', label: 'Squarish', note: '900×720', width: 900, height: 720, scroll: false, embed: true },
  { id: 'claude-port', label: 'Portrait', note: '640×1080', width: 640, height: 1080, scroll: false, embed: true },
]

const NEW_DESKTOP_IFRAME: PreviewVersion[] = [
  { id: 'brand-frame', label: 'Checkout', note: '520×800', width: 520, height: 800, scroll: true, embed: true },
  { id: 'brand-tall', label: 'Tall', note: '520×960', width: 520, height: 960, scroll: true, embed: true },
]

export function versionsFor(device: Device, mode: Mode, design: 'old' | 'new' = 'old'): PreviewVersion[] {
  if (device === 'mobile' || mode === 'redirect') return MOBILE_REDIRECT
  if (design === 'new') return NEW_DESKTOP_IFRAME
  return DESKTOP_IFRAME
}
