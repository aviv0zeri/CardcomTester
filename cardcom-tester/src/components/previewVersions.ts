import { isNewDesign, isOpenFieldsDesign, type Design, type Device, type Language, type Mode } from './CheckoutControls'

export type PreviewVersion = {
  id: string
  label: string
  note: string
  width: number
  height: number
  scroll: boolean
  embed: boolean
}

// Open Fields billing templates: which country's form layout to show.
export type OpenFieldsRegion = 'il' | 'us' | 'eu'

// Open Fields page theme: follow the viewer's OS, or force one to preview it.
export type PageTheme = 'system' | 'light' | 'dark'

export const PAGE_THEMES: PageTheme[] = ['system', 'light', 'dark']

export const OPEN_FIELDS_REGIONS: { value: OpenFieldsRegion; label: string }[] = [
  { value: 'il', label: 'Israel' },
  { value: 'us', label: 'US' },
  { value: 'eu', label: 'Europe' },
]

// A different Cardcom integration entirely (merchant-owned form + two of
// Cardcom's own iframes via postMessage, not a hosted page). Its page reads:
// preview=1 -> never touches the API; lpid -> reuses a session created
// elsewhere (the API lab); neither -> creates its own session on Continue.
// region picks the billing template; amount only matters for the invoice
// document's product line (il template, checkbox on). embed -> tight padding
// and short credits so the page fits a sized iframe without scrolling;
// screen=checkout -> skip the page's own cart screen (the tester's two-panel
// view shows its own order summary instead). brand -> which business's logo the
// page shows (an allowlisted id the page maps itself; never a URL). theme ->
// force light/dark instead of following the OS ('system' sends nothing).
// accent -> the page's accent colour as six hex digits (the page validates).
// testFill -> show the page's tester-only "Fill test details" button.
export function openFieldsUrl(
  language: Language,
  opts: {
    preview?: boolean
    lpid?: string
    region?: OpenFieldsRegion
    amount?: number
    embed?: boolean
    screen?: 'checkout'
    brand?: string
    theme?: PageTheme
    accent?: string
    testFill?: boolean
    // 2-4 pads the wallet row with mock wallets after the real Google Pay.
    wallets?: number
    // 'box' -> Open Fields 2.1: number | expiry / CVV in one bordered box.
    fields?: 'box'
  } = {},
) {
  const lang = language === 'en' ? 'en' : 'he'
  const params = new URLSearchParams({ lang })
  if (opts.region) params.set('region', opts.region)
  if (opts.preview) params.set('preview', '1')
  if (opts.lpid) params.set('lpid', opts.lpid)
  if (opts.amount && Number.isFinite(opts.amount)) params.set('amount', String(opts.amount))
  if (opts.embed) params.set('embed', '1')
  if (opts.screen) params.set('screen', opts.screen)
  if (opts.brand) params.set('brand', opts.brand)
  if (opts.theme && opts.theme !== 'system') params.set('theme', opts.theme)
  if (opts.accent) params.set('accent', opts.accent.replace(/^#/, ''))
  if (opts.testFill) params.set('testfill', '1')
  if (opts.wallets && opts.wallets > 1) params.set('wallets', String(Math.min(4, opts.wallets)))
  if (opts.fields) params.set('fields', opts.fields)
  return `/cardcom-preview/open-fields/form.html?${params}`
}

export function localPreviewUrl(
  language: Language,
  embed: boolean,
  design: Design,
  opts: { region?: OpenFieldsRegion; screen?: 'checkout'; brand?: string } = {},
) {
  if (isOpenFieldsDesign(design)) {
    return openFieldsUrl(language, {
      preview: true,
      region: opts.region,
      embed,
      screen: opts.screen,
      brand: opts.brand,
      fields: design === 'openfields21' ? 'box' : undefined,
    })
  }
  const kind = embed ? `${language}/embed` : language
  const params = new URLSearchParams({
    v: `low-profile/${kind}`,
    wallets: '4',
  })
  // brand=1 is the compact skin; brand=21 layers the 2.1 card box on top of it.
  if (design === 'new') params.set('brand', '1')
  if (design === 'new21') params.set('brand', '21')
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

// Single-column checkout (Stripe/Shopify-style), sized to the tallest state
// measured in embed mode so nothing inside ever needs to scroll: Israel
// with the invoice fields open plus the brand header, the wallet row and
// an inline payment-status line under Pay now (~830px at 500 wide). 500
// wide leaves the page's 460px card centered with its own padding.
const OPEN_FIELDS_IFRAME: PreviewVersion[] = [
  { id: 'of-frame', label: 'Checkout', note: '500×860', width: 500, height: 860, scroll: false, embed: true },
]

export function versionsFor(
  device: Device,
  mode: Mode,
  design: Design = 'old',
): PreviewVersion[] {
  // Merchant-owned page: no phone/tablet framing variants, and on a real
  // phone it opens as a plain page. Desktop iframe is the tester's own box.
  if (isOpenFieldsDesign(design)) return device === 'desktop' && mode === 'iframe' ? OPEN_FIELDS_IFRAME : []
  if (device === 'mobile') return [...MOBILE_REDIRECT, ...MOBILE_IFRAME]
  if (mode === 'redirect') return MOBILE_REDIRECT
  if (isNewDesign(design)) return NEW_DESKTOP_IFRAME
  return DESKTOP_IFRAME
}

export function isRealPhone(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.screen.width, window.screen.height) < 820
  return coarse && small
}
