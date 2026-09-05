// The guided walkthrough's cart model: a tiny catalog, ready-made bundles and
// the helpers that turn a cart into an amount, a summary, receipt products or
// the object the merchant's app would hold. UI lives in GuidedCart.tsx.

export type CartLang = 'en' | 'he'

export type CartItem = {
  id: string
  // Catalog items keep their id so the name follows the UI language; a typed
  // item has only the name the tester gave it.
  catalogId?: string
  name: string
  price: number
  qty: number
}

export type CartObject = {
  currency: 'ILS'
  items: { name: string; unit_price: number; quantity: number }[]
  total: number
}

export type Catalog = { id: string; emoji: string; price: number; name: Record<CartLang, string> }
export type Bundle = { id: string; emoji: string; name: Record<CartLang, string>; items: [string, number][] }

export const CATALOG: Catalog[] = [
  { id: 'latte', emoji: '☕', price: 18, name: { en: 'Latte', he: 'לאטה' } },
  { id: 'croissant', emoji: '🥐', price: 14, name: { en: 'Croissant', he: 'קרואסון' } },
  { id: 'tshirt', emoji: '👕', price: 89, name: { en: 'T-shirt', he: 'חולצה' } },
  { id: 'socks', emoji: '🧦', price: 24, name: { en: 'Socks', he: 'גרביים' } },
  { id: 'shipping', emoji: '🚚', price: 15, name: { en: 'Shipping', he: 'משלוח' } },
  { id: 'plan', emoji: '🔁', price: 105, name: { en: 'Monthly plan', he: 'מנוי חודשי' } },
  { id: 'gift', emoji: '🎁', price: 50, name: { en: 'Gift card', he: 'שובר מתנה' } },
]

export const BUNDLES: Bundle[] = [
  { id: 'coffee', emoji: '☕', name: { en: 'Coffee run', he: 'סיבוב קפה' }, items: [['latte', 2], ['croissant', 1]] },
  { id: 'shop', emoji: '🛍️', name: { en: 'Shop order', he: 'הזמנה מהחנות' }, items: [['tshirt', 1], ['socks', 2], ['shipping', 1]] },
  { id: 'sub', emoji: '🔁', name: { en: 'Subscription', he: 'מנוי' }, items: [['plan', 1]] },
]

export const uid = () => Math.random().toString(36).slice(2, 8)
export const round = (n: number) => Math.round(n * 100) / 100
export const fmtIls = (n: number) => `₪${n.toFixed(2)}`

export function bundleItems(bundle: Bundle): CartItem[] {
  return bundle.items.map(([catalogId, qty]) => {
    const entry = CATALOG.find((c) => c.id === catalogId)!
    return { id: uid(), catalogId, name: entry.name.en, price: entry.price, qty }
  })
}

export const DEFAULT_CART: CartItem[] = bundleItems(BUNDLES[0])

export function cartTotal(items: CartItem[]) {
  return round(items.reduce((sum, item) => sum + item.price * item.qty, 0))
}

// Names resolved for a language (catalog items translate; typed ones don't).
export function resolveItems(items: CartItem[], lang: CartLang): CartItem[] {
  return items.map((item) => {
    const entry = item.catalogId ? CATALOG.find((c) => c.id === item.catalogId) : undefined
    return entry ? { ...item, name: entry.name[lang] } : item
  })
}

export function cartObject(items: CartItem[], lang: CartLang): CartObject {
  return {
    currency: 'ILS',
    items: resolveItems(items, lang).map((item) => ({ name: item.name, unit_price: item.price, quantity: item.qty })),
    total: cartTotal(items),
  }
}

export const emojiFor = (item: CartItem) => CATALOG.find((c) => c.id === item.catalogId)?.emoji ?? '🏷️'
