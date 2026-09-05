// The guided walkthrough's cart model: a small catalog, a few one-tap quick fills
// and the helpers that turn a cart into an amount, the summary's lines, the
// receipt's products, the API's line_items, or the object the merchant's app
// holds. UI lives in GuidedCart.tsx.

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

// What POST /checkout-sessions and POST /payments accept as line_items.
export type ApiLineItem = { name: string; unit_price: string; quantity: number }

export type Product = {
  id: string
  price: number
  name: Record<CartLang, string>
  blurb: Record<CartLang, string>
}

export type QuickPick = { id: string; name: Record<CartLang, string>; items: [string, number][] }

export const CATALOG: Product[] = [
  { id: 'latte', price: 18, name: { en: 'Latte', he: 'לאטה' }, blurb: { en: 'Oat milk, double shot', he: 'חלב שיבולת שועל, כפול' } },
  { id: 'croissant', price: 14, name: { en: 'Butter croissant', he: 'קרואסון חמאה' }, blurb: { en: 'Baked this morning', he: 'נאפה הבוקר' } },
  { id: 'tshirt', price: 89, name: { en: 'T-shirt', he: 'חולצה' }, blurb: { en: 'Organic cotton, unisex', he: 'כותנה אורגנית, יוניסקס' } },
  { id: 'socks', price: 24, name: { en: 'Socks', he: 'גרביים' }, blurb: { en: 'Pack of two', he: 'זוג במארז' } },
  { id: 'shipping', price: 15, name: { en: 'Shipping', he: 'משלוח' }, blurb: { en: 'Israel, 2–4 business days', he: 'לכל הארץ, 2–4 ימי עסקים' } },
  { id: 'plan', price: 105, name: { en: 'Monthly plan', he: 'מנוי חודשי' }, blurb: { en: 'Billed monthly, cancel anytime', he: 'חיוב חודשי, ניתן לבטל בכל עת' } },
  { id: 'gift', price: 50, name: { en: 'Gift card', he: 'שובר מתנה' }, blurb: { en: 'Delivered by email', he: 'נשלח במייל' } },
]

export const QUICK_PICKS: QuickPick[] = [
  { id: 'coffee', name: { en: 'Coffee run', he: 'סיבוב קפה' }, items: [['latte', 2], ['croissant', 1]] },
  { id: 'shop', name: { en: 'Shop order', he: 'הזמנה מהחנות' }, items: [['tshirt', 1], ['socks', 2], ['shipping', 1]] },
  { id: 'sub', name: { en: 'Subscription', he: 'מנוי' }, items: [['plan', 1]] },
]

export const uid = () => Math.random().toString(36).slice(2, 8)
export const round = (n: number) => Math.round(n * 100) / 100
export const fmtIls = (n: number) => `₪${n.toFixed(2)}`

export function quickPickItems(pick: QuickPick): CartItem[] {
  return pick.items.map(([catalogId, qty]) => {
    const product = CATALOG.find((p) => p.id === catalogId)!
    return { id: uid(), catalogId, name: product.name.en, price: product.price, qty }
  })
}

// The store is entered empty on purpose: picking is the point of the step.
export const DEFAULT_CART: CartItem[] = []

export function cartTotal(items: CartItem[]) {
  return round(items.reduce((sum, item) => sum + item.price * item.qty, 0))
}

// Names resolved for a language (catalog items translate; typed ones don't).
export function resolveItems(items: CartItem[], lang: CartLang): CartItem[] {
  return items.map((item) => {
    const product = item.catalogId ? CATALOG.find((p) => p.id === item.catalogId) : undefined
    return product ? { ...item, name: product.name[lang] } : item
  })
}

export function cartObject(items: CartItem[], lang: CartLang): CartObject {
  return {
    currency: 'ILS',
    items: resolveItems(items, lang).map((item) => ({ name: item.name, unit_price: item.price, quantity: item.qty })),
    total: cartTotal(items),
  }
}

// The same lines in the API's wire shape (unit_price as a 2-decimal string, like
// amount). The API checks they sum to amount exactly -- they do, by construction.
export function apiLineItems(items: CartItem[], lang: CartLang): ApiLineItem[] {
  return resolveItems(items, lang).map((item) => ({
    name: item.name,
    unit_price: item.price.toFixed(2),
    quantity: item.qty,
  }))
}
