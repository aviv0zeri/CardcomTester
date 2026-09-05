import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import gsap from 'gsap'
import {
  CATALOG,
  QUICK_PICKS,
  cartObject,
  cartTotal,
  fmtIls,
  quickPickItems,
  resolveItems,
  round,
  uid,
  type CartItem,
  type CartLang,
  type Product,
  type QuickPick,
} from './cart'
import './guidedCart.css'

// The guided walkthrough's pretend shop, in two views. STORE: the merchant's own
// storefront -- tiles to add, a quick-fill row, a bar with the running total.
// CART: one big card with everything picked, concentrated: lines with quantity
// controls, the total, the object as JSON, the checkout options, and Checkout.
// The cart's total is the amount we charge and its lines travel with the session
// to our Payments API as line_items (and onto the receipt).

type View = 'store' | 'cart'

const STRINGS: Record<CartLang, Record<string, string>> = {
  en: {
    storeKicker: 'Pretend store',
    store: 'Store',
    quick: 'Quick fill',
    add: 'Add',
    customTitle: 'Your own item',
    customName: 'Name',
    items: 'items',
    item: 'item',
    inCart: 'in the cart',
    viewCart: 'View cart',
    cart: 'Cart',
    cartKicker: 'Checkout · step 1',
    yourCart: 'Your cart',
    empty: 'Nothing here yet — back to the store to pick something.',
    total: 'Total',
    showJson: 'Show as JSON',
    hideJson: 'Hide JSON',
    note: 'This is the object your app holds. It travels with the session to our Payments API as line_items, and becomes the lines on the receipt.',
    backToStore: 'Back to store',
    checkout: 'Checkout',
    back: 'Back',
    less: 'One less',
    more: 'One more',
    remove: 'Remove',
  },
  he: {
    storeKicker: 'חנות לדוגמה',
    store: 'חנות',
    quick: 'מילוי מהיר',
    add: 'הוסף',
    customTitle: 'פריט משלכם',
    customName: 'שם',
    items: 'פריטים',
    item: 'פריט',
    inCart: 'בעגלה',
    viewCart: 'לעגלה',
    cart: 'עגלה',
    cartKicker: 'קופה · שלב 1',
    yourCart: 'העגלה שלך',
    empty: 'עדיין ריק — חזרו לחנות ובחרו משהו.',
    total: 'סה"כ',
    showJson: 'הצג כ-JSON',
    hideJson: 'הסתר JSON',
    note: 'זה האובייקט שהאפליקציה שלכם מחזיקה. הוא נשלח יחד עם הסשן ל-API של התשלומים שלנו בתור line_items, והופך לשורות בקבלה.',
    backToStore: 'חזרה לחנות',
    checkout: 'המשך לתשלום',
    back: 'חזרה',
    less: 'אחד פחות',
    more: 'אחד יותר',
    remove: 'הסר',
  },
}

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

type GuidedCartProps = {
  lang: CartLang
  items: CartItem[]
  onChange: (items: CartItem[]) => void
  disabled?: boolean
  brandName: string
  // The payment-page options (presentation / template / receipt), shown under
  // the cart card so they sit with the checkout, not with the shopping.
  options?: ReactNode
  onBack: () => void
  onCheckout: () => void
  checkoutDisabled?: boolean
}

export function GuidedCart({
  lang,
  items,
  onChange,
  disabled,
  brandName,
  options,
  onBack,
  onCheckout,
  checkoutDisabled,
}: GuidedCartProps) {
  const T = STRINGS[lang]
  const [view, setView] = useState<View>('store')
  const [custom, setCustom] = useState({ name: '', price: '' })
  const [showJson, setShowJson] = useState(false)
  const cartBtnRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const linesRef = useRef<HTMLDivElement>(null)
  const totalRef = useRef<HTMLSpanElement>(null)
  const shownTotal = useRef(cartTotal(items))
  // Lines to animate in after the next render (set by the add handlers).
  const pendingLines = useRef<string[] | null>(null)
  const total = cartTotal(items)
  const count = items.reduce((sum, item) => sum + item.qty, 0)
  const resolved = resolveItems(items, lang)
  const qtyOf = (productId: string) => items.find((item) => item.catalogId === productId)?.qty ?? 0

  // The card's total counts to its new value.
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
  }, [total, view])

  // Entering the cart: the card rises in and its lines follow.
  useLayoutEffect(() => {
    if (view !== 'cart' || !cardRef.current || reduceMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { y: 28, autoAlpha: 0, scale: 0.97 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out', clearProps: 'all' },
      )
      gsap.fromTo(
        '.gs-line',
        { y: 10, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.35, stagger: 0.06, delay: 0.15, ease: 'power2.out', clearProps: 'all' },
      )
    }, cardRef)
    return () => ctx.revert()
  }, [view])

  // Lines added while the card is showing drop into place.
  useLayoutEffect(() => {
    const ids = pendingLines.current
    pendingLines.current = null
    if (!ids || reduceMotion() || !linesRef.current) return
    const rows = ids
      .map((id) => linesRef.current!.querySelector<HTMLElement>(`[data-item="${id}"]`))
      .filter((row): row is HTMLElement => Boolean(row))
    if (!rows.length) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        rows,
        { y: -12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.4, ease: 'back.out(1.6)', stagger: 0.06, clearProps: 'all' },
      )
    })
    return () => ctx.revert()
  }, [items])

  // Detached clone of an element, positioned over it, for fly/exit tweens. State
  // never waits on these -- GSAP's ticker is rAF-driven and freezes in a hidden
  // tab -- so a ghost is purely visual and swept by a timer regardless.
  const makeGhost = (source: HTMLElement) => {
    const rect = source.getBoundingClientRect()
    const ghost = source.cloneNode(true) as HTMLElement
    ghost.classList.add('gs-ghost')
    ghost.setAttribute('aria-hidden', 'true')
    Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
    document.body.appendChild(ghost)
    window.setTimeout(() => ghost.remove(), 1500)
    return { ghost, rect }
  }

  // The tapped control flies into the store header's cart button, which bumps.
  const flyToCart = (source: HTMLElement | null) => {
    const target = cartBtnRef.current
    if (reduceMotion() || !source || !target) return
    const { ghost, rect: a } = makeGhost(source)
    const b = target.getBoundingClientRect()
    gsap.to(ghost, {
      x: b.left + b.width / 2 - (a.left + a.width / 2),
      y: b.top + b.height / 2 - (a.top + a.height / 2),
      scale: 0.2,
      autoAlpha: 0.1,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => ghost.remove(),
    })
    gsap.fromTo(target, { scale: 1 }, { scale: 1.08, duration: 0.14, delay: 0.4, yoyo: true, repeat: 1, ease: 'power1.inOut', clearProps: 'all' })
  }

  const add = (product: Product, source: HTMLElement | null) => {
    if (disabled) return
    flyToCart(source)
    const existing = items.find((item) => item.catalogId === product.id)
    if (existing) {
      onChange(items.map((item) => (item === existing ? { ...item, qty: item.qty + 1 } : item)))
      return
    }
    const item: CartItem = { id: uid(), catalogId: product.id, name: product.name[lang], price: product.price, qty: 1 }
    pendingLines.current = [item.id]
    onChange([...items, item])
  }

  const setQty = (id: string, qty: number) => {
    if (disabled) return
    if (qty <= 0) {
      remove(id)
      return
    }
    onChange(items.map((item) => (item.id === id ? { ...item, qty } : item)))
  }

  // Removal commits at once; the line's ghost slides out over the closing gap.
  const remove = (id: string) => {
    if (disabled) return
    const row = linesRef.current?.querySelector<HTMLElement>(`[data-item="${id}"]`)
    if (!reduceMotion() && row) {
      const { ghost } = makeGhost(row)
      gsap.to(ghost, { x: lang === 'he' ? 28 : -28, autoAlpha: 0, duration: 0.22, ease: 'power2.in', onComplete: () => ghost.remove() })
    }
    onChange(items.filter((item) => item.id !== id))
  }

  const pickQuick = (pick: QuickPick, source: HTMLElement | null) => {
    if (disabled) return
    flyToCart(source)
    const next = quickPickItems(pick)
    pendingLines.current = next.map((item) => item.id)
    onChange(next)
  }

  const customPrice = Number(custom.price)
  const customReady = custom.name.trim().length > 0 && customPrice > 0
  const addCustom = (event: FormEvent) => {
    event.preventDefault()
    if (disabled || !customReady) return
    const item: CartItem = { id: uid(), name: custom.name.trim(), price: round(customPrice), qty: 1 }
    pendingLines.current = [item.id]
    flyToCart(event.currentTarget as HTMLElement)
    onChange([...items, item])
    setCustom({ name: '', price: '' })
  }

  const countLabel = `${count} ${count === 1 ? T.item : T.items} ${T.inCart}`

  const qtyControl = (id: string, qty: number) => (
    <span className="gs-qty" dir="ltr">
      <button type="button" disabled={disabled} onClick={() => setQty(id, qty - 1)} aria-label={T.less}>
        −
      </button>
      <b>{qty}</b>
      <button type="button" disabled={disabled} onClick={() => setQty(id, qty + 1)} aria-label={T.more}>
        +
      </button>
    </span>
  )

  if (view === 'store') {
    return (
      <div className={`gs${disabled ? ' is-disabled' : ''}`}>
        <header className="gs-head">
          <div className="gs-title">
            <span className="gs-kicker">{T.storeKicker}</span>
            <strong>
              {brandName} · {T.store}
            </strong>
          </div>
          <button
            type="button"
            ref={cartBtnRef}
            className="gs-cartbtn"
            disabled={disabled || !items.length}
            onClick={() => setView('cart')}
          >
            <span>{T.cart}</span>
            <b className="gs-count">{count}</b>
            <span className="gs-cartbtn-total" dir="ltr">
              {fmtIls(total)}
            </span>
          </button>
        </header>

        <div className="gs-quick">
          <span className="gs-quick-label">{T.quick}</span>
          {QUICK_PICKS.map((pick) => (
            <button
              key={pick.id}
              type="button"
              className="gs-quick-btn"
              disabled={disabled}
              onClick={(event) => pickQuick(pick, event.currentTarget)}
            >
              {pick.name[lang]}
              <em dir="ltr">{fmtIls(cartTotal(quickPickItems(pick)))}</em>
            </button>
          ))}
        </div>

        <div className="gs-grid">
          {CATALOG.map((product) => {
            const qty = qtyOf(product.id)
            const inCart = items.find((item) => item.catalogId === product.id)
            return (
              <article key={product.id} className={`gs-tile${qty ? ' is-in-cart' : ''}`}>
                <div className="gs-tile-body">
                  <strong>{product.name[lang]}</strong>
                  <span>{product.blurb[lang]}</span>
                </div>
                <div className="gs-tile-foot">
                  <span className="gs-price" dir="ltr">
                    {fmtIls(product.price)}
                  </span>
                  {inCart ? (
                    qtyControl(inCart.id, qty)
                  ) : (
                    <button
                      type="button"
                      className="gs-add"
                      disabled={disabled}
                      onClick={(event) => add(product, event.currentTarget)}
                    >
                      {T.add}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
          <form className="gs-tile gs-tile--custom" onSubmit={addCustom}>
            <div className="gs-tile-body">
              <strong>{T.customTitle}</strong>
              <input
                value={custom.name}
                placeholder={T.customName}
                disabled={disabled}
                maxLength={40}
                onChange={(event) => setCustom({ ...custom, name: event.target.value })}
              />
            </div>
            <div className="gs-tile-foot">
              <input
                className="gs-price-input"
                value={custom.price}
                placeholder="0.00"
                inputMode="decimal"
                dir="ltr"
                disabled={disabled}
                onChange={(event) => setCustom({ ...custom, price: event.target.value })}
              />
              <button type="submit" className="gs-add" disabled={disabled || !customReady}>
                {T.add}
              </button>
            </div>
          </form>
        </div>

        <div className="gs-bar">
          <span className="gs-bar-summary">
            {countLabel}
            {count ? (
              <>
                {' · '}
                <b dir="ltr">{fmtIls(total)}</b>
              </>
            ) : null}
          </span>
          <button
            type="button"
            className="cta-button gw-pulse"
            disabled={disabled || !items.length}
            onClick={() => setView('cart')}
          >
            {T.viewCart} {lang === 'he' ? '←' : '→'}
          </button>
        </div>
        <div className="gw-actions">
          <button type="button" className="text-btn" onClick={onBack}>
            {T.back}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`gs${disabled ? ' is-disabled' : ''}`}>
      <section className="gs-card" ref={cardRef} aria-label={T.yourCart}>
        <header className="gs-card-head">
          <div className="gs-title">
            <span className="gs-kicker">{T.cartKicker}</span>
            <strong>{T.yourCart}</strong>
          </div>
          <span className="gs-card-brand">{brandName}</span>
        </header>
        <div className="gs-card-lines" ref={linesRef}>
          {resolved.length === 0 ? (
            <div className="gs-empty">{T.empty}</div>
          ) : (
            resolved.map((item) => (
              <div className="gs-line" data-item={item.id} key={item.id}>
                <div className="gs-line-name">
                  <strong>{item.name}</strong>
                  <small dir="ltr">
                    {fmtIls(item.price)} × {item.qty}
                  </small>
                </div>
                {qtyControl(item.id, item.qty)}
                <span className="gs-line-total" dir="ltr">
                  {fmtIls(round(item.price * item.qty))}
                </span>
                <button type="button" className="gs-remove" disabled={disabled} onClick={() => remove(item.id)} aria-label={T.remove}>
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <footer className="gs-card-foot">
          <span>{T.total}</span>
          <span className="gs-card-total" ref={totalRef} dir="ltr">
            {fmtIls(total)}
          </span>
        </footer>
        <div className="gs-card-json">
          <button type="button" className="text-btn" onClick={() => setShowJson((value) => !value)}>
            {showJson ? T.hideJson : T.showJson}
          </button>
          {showJson ? (
            <>
              <pre className="gw-json" dir="ltr">
                {JSON.stringify(cartObject(items, lang), null, 2)}
              </pre>
              <p className="gs-note">{T.note}</p>
            </>
          ) : null}
        </div>
      </section>

      {options ? <div className="gs-options">{options}</div> : null}

      <div className="gw-actions">
        <button type="button" className="text-btn" onClick={() => setView('store')}>
          {lang === 'he' ? '→' : '←'} {T.backToStore}
        </button>
        <button
          type="button"
          className="cta-button gw-pulse"
          disabled={disabled || checkoutDisabled || !items.length}
          onClick={onCheckout}
        >
          {T.checkout}
        </button>
      </div>
    </div>
  )
}
