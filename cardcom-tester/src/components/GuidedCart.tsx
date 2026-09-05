import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import gsap from 'gsap'
import {
  BUNDLES,
  CATALOG,
  bundleItems,
  cartObject,
  cartTotal,
  emojiFor,
  fmtIls,
  resolveItems,
  round,
  uid,
  type Bundle,
  type CartItem,
  type CartLang,
  type Catalog,
} from './cart'
import './guidedCart.css'

// The guided walkthrough's pretend shopping cart. It stands in for the
// merchant's own app: the tester stacks items (a ready-made cart, single
// items, or something they type), and the cart's total becomes the amount we
// charge. Only the total reaches our Payments API today -- its
// CreateCheckoutSession takes `amount`, not line items -- so the cart object
// is shown as the thing the merchant's app holds, the summary column renders
// its lines, and the raw-Cardcom receipt path sends them as document
// products. Sending line items through our API is the next API step.

const STRINGS: Record<CartLang, Record<string, string>> = {
  en: {
    title: 'Your cart',
    subtitle: 'Pick a ready-made cart, or add things one by one.',
    bundles: 'Ready-made carts',
    oneAtATime: 'Or add one thing at a time',
    customName: 'Something else…',
    add: 'Add',
    empty: 'Your cart is empty — tap something above.',
    total: 'Total',
    showObject: 'Show the cart object',
    hideObject: 'Hide the cart object',
    note: 'This is what your app holds. Today our Payments API takes only the total, as amount — sending the line items themselves is the next API step.',
    less: 'One less',
    more: 'One more',
    remove: 'Remove',
    qty: 'Qty',
  },
  he: {
    title: 'העגלה שלך',
    subtitle: 'בחרו עגלה מוכנה, או הוסיפו דבר-דבר.',
    bundles: 'עגלות מוכנות',
    oneAtATime: 'או הוסיפו פריט אחד בכל פעם',
    customName: 'משהו אחר…',
    add: 'הוסף',
    empty: 'העגלה ריקה — לחצו על משהו למעלה.',
    total: 'סה"כ',
    showObject: 'הצג את אובייקט העגלה',
    hideObject: 'הסתר את אובייקט העגלה',
    note: 'זה מה שהאפליקציה שלכם מחזיקה. היום ה-API של התשלומים שלנו מקבל רק את הסכום הכולל, בתור amount — שליחת הפריטים עצמם היא הצעד הבא ב-API.',
    less: 'אחד פחות',
    more: 'אחד יותר',
    remove: 'הסר',
    qty: 'כמות',
  },
}

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

type GuidedCartProps = {
  lang: CartLang
  items: CartItem[]
  onChange: (items: CartItem[]) => void
  disabled?: boolean
}

export function GuidedCart({ lang, items, onChange, disabled }: GuidedCartProps) {
  const T = STRINGS[lang]
  const listRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const totalRef = useRef<HTMLSpanElement>(null)
  // Latest items for callbacks that fire after an exit animation.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  const shownTotal = useRef(cartTotal(items))
  // Rows to animate in after the next render (set by the add handlers).
  const pendingRows = useRef<string[] | null>(null)
  const [custom, setCustom] = useState({ name: '', price: '' })
  const [showObject, setShowObject] = useState(false)
  const total = cartTotal(items)
  const resolved = resolveItems(items, lang)
  const count = items.reduce((sum, item) => sum + item.qty, 0)

  // The headline total counts up/down to its new value.
  useEffect(() => {
    const el = totalRef.current
    if (!el) return
    const from = shownTotal.current
    if (reduceMotion() || from === total) {
      el.textContent = fmtIls(total)
      shownTotal.current = total
      return
    }
    const obj = { v: from }
    const tween = gsap.to(obj, {
      v: total,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = fmtIls(obj.v)
      },
      onComplete: () => {
        el.textContent = fmtIls(total)
      },
    })
    return () => {
      tween.kill()
      shownTotal.current = obj.v
    }
  }, [total])

  // Newly added rows drop into the stack; the cart icon gives a little bounce.
  useLayoutEffect(() => {
    const ids = pendingRows.current
    pendingRows.current = null
    if (!ids || reduceMotion() || !listRef.current) return
    const rows = ids
      .map((id) => listRef.current!.querySelector<HTMLElement>(`[data-item="${id}"]`))
      .filter((row): row is HTMLElement => Boolean(row))
    if (!rows.length) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        rows,
        { y: -14, autoAlpha: 0, scale: 0.96 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.7)', stagger: 0.08, clearProps: 'all' },
      )
      if (iconRef.current) {
        gsap.fromTo(iconRef.current, { scale: 1 }, { scale: 1.25, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut', clearProps: 'all' })
      }
    })
    return () => ctx.revert()
  }, [items])

  // Detached clone of an element, positioned over it, for fly/exit tweens.
  // State never waits on these: GSAP's ticker is rAF-driven and freezes in a
  // hidden tab, so a ghost is purely visual and is swept by a timer even if
  // its tween never finishes.
  const makeGhost = (source: HTMLElement) => {
    const rect = source.getBoundingClientRect()
    const ghost = source.cloneNode(true) as HTMLElement
    ghost.classList.add('gc-ghost')
    ghost.setAttribute('aria-hidden', 'true')
    Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
    document.body.appendChild(ghost)
    window.setTimeout(() => ghost.remove(), 1500)
    return { ghost, rect }
  }

  // A ghost of the tapped button flies into the cart icon.
  const flyFrom = (source: HTMLElement | null) => {
    const target = iconRef.current
    if (reduceMotion() || !source || !target) return
    const { ghost, rect: a } = makeGhost(source)
    const b = target.getBoundingClientRect()
    gsap.to(ghost, {
      x: b.left + b.width / 2 - (a.left + a.width / 2),
      y: b.top + b.height / 2 - (a.top + a.height / 2),
      scale: 0.25,
      autoAlpha: 0.15,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => ghost.remove(),
    })
  }

  const add = (entry: Catalog, source: HTMLElement | null) => {
    if (disabled) return
    flyFrom(source)
    const existing = items.find((item) => item.catalogId === entry.id)
    if (existing) {
      pendingRows.current = [existing.id]
      onChange(items.map((item) => (item === existing ? { ...item, qty: item.qty + 1 } : item)))
      return
    }
    const item: CartItem = { id: uid(), catalogId: entry.id, name: entry.name[lang], price: entry.price, qty: 1 }
    pendingRows.current = [item.id]
    onChange([...items, item])
  }

  const pickBundle = (bundle: Bundle, source: HTMLElement | null) => {
    if (disabled) return
    flyFrom(source)
    const next = bundleItems(bundle)
    pendingRows.current = next.map((item) => item.id)
    onChange(next)
  }

  const customPrice = Number(custom.price)
  const customReady = custom.name.trim().length > 0 && customPrice > 0
  const addCustom = (event: FormEvent) => {
    event.preventDefault()
    if (disabled || !customReady) return
    const item: CartItem = { id: uid(), name: custom.name.trim(), price: round(customPrice), qty: 1 }
    pendingRows.current = [item.id]
    onChange([...items, item])
    setCustom({ name: '', price: '' })
  }

  const changeQty = (id: string, delta: number) => {
    if (disabled) return
    const target = items.find((item) => item.id === id)
    if (!target) return
    if (target.qty + delta <= 0) {
      remove(id)
      return
    }
    onChange(items.map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item)))
  }

  // Removal commits at once; the row's ghost slides out over the collapsing list.
  const remove = (id: string) => {
    if (disabled) return
    const row = listRef.current?.querySelector<HTMLElement>(`[data-item="${id}"]`)
    if (!reduceMotion() && row) {
      const { ghost } = makeGhost(row)
      gsap.to(ghost, { x: lang === 'he' ? 28 : -28, autoAlpha: 0, duration: 0.22, ease: 'power2.in', onComplete: () => ghost.remove() })
    }
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <div className={`gc${disabled ? ' is-disabled' : ''}`}>
      <div className="gc-head">
        <span className="gc-icon" ref={iconRef} aria-hidden="true">
          🛒<b className="gc-count">{count}</b>
        </span>
        <div className="gc-title">
          <strong>{T.title}</strong>
          <span>{T.subtitle}</span>
        </div>
        <span className="gc-total" ref={totalRef} dir="ltr">
          {fmtIls(total)}
        </span>
      </div>

      <div className="gc-section">
        <span className="gc-label">{T.bundles}</span>
        <div className="gc-bundles">
          {BUNDLES.map((bundle) => (
            <button
              key={bundle.id}
              type="button"
              className="gc-bundle"
              disabled={disabled}
              onClick={(event) => pickBundle(bundle, event.currentTarget)}
            >
              <span className="gc-emoji" aria-hidden="true">
                {bundle.emoji}
              </span>
              <span className="gc-bundle-name">{bundle.name[lang]}</span>
              <span className="gc-bundle-price" dir="ltr">
                {fmtIls(cartTotal(bundleItems(bundle)))}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="gc-section">
        <span className="gc-label">{T.oneAtATime}</span>
        <div className="gc-chips">
          {CATALOG.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="gc-chip"
              disabled={disabled}
              onClick={(event) => add(entry, event.currentTarget)}
            >
              <span aria-hidden="true">{entry.emoji}</span> {entry.name[lang]}{' '}
              <em dir="ltr">{fmtIls(entry.price)}</em>
            </button>
          ))}
        </div>
        <form className="gc-custom" onSubmit={addCustom}>
          <input
            value={custom.name}
            placeholder={T.customName}
            disabled={disabled}
            maxLength={40}
            onChange={(event) => setCustom({ ...custom, name: event.target.value })}
          />
          <input
            value={custom.price}
            placeholder="0.00"
            inputMode="decimal"
            dir="ltr"
            disabled={disabled}
            onChange={(event) => setCustom({ ...custom, price: event.target.value })}
          />
          <button type="submit" className="cta-button" disabled={disabled || !customReady}>
            {T.add}
          </button>
        </form>
      </div>

      <div className="gc-list" ref={listRef}>
        {resolved.length === 0 ? (
          <div className="gc-empty">{T.empty}</div>
        ) : (
          resolved.map((item) => (
            <div className="gc-row" data-item={item.id} key={item.id}>
              <span className="gc-row-emoji" aria-hidden="true">
                {emojiFor(item)}
              </span>
              <span className="gc-row-name">
                {item.name}
                <small dir="ltr">
                  {fmtIls(item.price)} × {item.qty}
                </small>
              </span>
              <span className="gc-qty" dir="ltr">
                <button type="button" disabled={disabled} onClick={() => changeQty(item.id, -1)} aria-label={T.less}>
                  −
                </button>
                <b>{item.qty}</b>
                <button type="button" disabled={disabled} onClick={() => changeQty(item.id, 1)} aria-label={T.more}>
                  +
                </button>
              </span>
              <span className="gc-row-price" dir="ltr">
                {fmtIls(round(item.price * item.qty))}
              </span>
              <button type="button" className="gc-remove" disabled={disabled} onClick={() => remove(item.id)} aria-label={T.remove}>
                ×
              </button>
            </div>
          ))
        )}
        <div className="gc-sum">
          <span>{T.total}</span>
          <span dir="ltr">{fmtIls(total)}</span>
        </div>
      </div>

      <button type="button" className="text-btn gc-toggle" onClick={() => setShowObject((value) => !value)}>
        {showObject ? T.hideObject : T.showObject}
      </button>
      {showObject ? (
        <div className="gc-object">
          <pre className="gw-json" dir="ltr">
            {JSON.stringify(cartObject(items, lang), null, 2)}
          </pre>
          <p className="gc-note">{T.note}</p>
        </div>
      ) : null}
    </div>
  )
}
