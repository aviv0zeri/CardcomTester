# Handoff: Aviv brand Low Profile (26 Aug 2026, evening)

Repo: `/Users/aviv0zeri/work/personal/CardcomTester`  
Phone tester: **https://cardcom-tester.vercel.app** (just redeployed)  
Local: Vite `http://127.0.0.1:5173` + Express `http://localhost:3000`

**User instruction for you:** This Low Profile is **not the final design**, but it is the working **new version**. Do **not** restart or redesign it from scratch. Native **app checkout is still not made**. Tell Aviv **what to do next** (Open Fields / native Direct / invoice via Create / live paste / logo hosting / anything you already scoped). Stay on Cardcom hosted Low Profile until he explicitly switches.

---

## What this project is

Cardcom hosts Low Profile (Knockout, wallets, validation, 3DS, payment). We paste **static HTML + CSS only**. No JS in paste files. Do not rewrite `data-bind` or Cardcom IDs. Do not CSS-hide `#txtCardOwnerPhone` or `#txtCardOwnerEmail`. **Never hide empty `#GooglePayDiv`.**

Cardcom stores **two** custom designs by direction, not four languages: RTL = Hebrew+Arabic, LTR = English+Russian. Same HTML for both slots. Same files for redirect and iframe.

Compact iframe: localhost uses `html.checkout-embed`; live Cardcom iframe uses `@media (min-width: 600px) and (max-width: 1280px)`. Fit the frame with no column scrollbar. Wide redirect (>1280px) stays page-scrollable.

The React app (`cardcom-tester/`) is a shell only (Old vs New, Local vs Cardcom, he/en/ar/ru). Do not touch the iframe DOM.

Export: `cardcom export` (new brand). Do not F5 Cardcom’s preview window after paste.

---

## Where the new design lives

**Do not overwrite canonical paste** (`templates/cardcom/low-profile/checkout.html` + `rtl/` + `ltr/`) until Aviv says to paste.

Working copy:

- `templates/cardcom/low-profile/_brand/checkout.html`
- `templates/cardcom/low-profile/_brand/brand-skin.css` — concatenated after RTL or LTR CSS on export
- `templates/cardcom/low-profile/_brand/logo_aviv.png` — show as-is (`object-fit: contain`). Not uploaded to Cardcom yet. Live `src` is still a localhost path; Cardcom needs HTTPS.

Preview:

```
/cardcom-preview/open.html?v=low-profile/{he|en|ar|ru}&brand=1&wallets=4
```

`cardcom export` copies `_brand/checkout.html`, then `rtl/checkout.css` **or** `ltr/checkout.css` **plus** `brand-skin.css`.

---

## What the new page is supposed to be

Compact card (~520px): logo, `{company_name}` placeholder (not “Aviv Ozeri”), 2×2 wallets, card fields, תקנון checkbox, pay button, SSL box, terms/privacy lines, Cardcom footer.

Invoice / billing blocks are **CSS-hidden** on this skin. Customer + document data should go in Low Profile Create (`Document` / invoice head) so Cardcom issues the invoice from the site. Create in `server/profiles.js` still does **not** send hide-invoice flags — CSS only.

Wallets: 2-column grid. Size the outer slot. Do not restyle Google/Apple/PayPal injected internals. Empty `#ApplePayDivContainer` / `#BitDivContainer` may be hidden. **Never** `:empty`-hide `#GooglePayDiv`.

---

## What we just finished (this thread)

1. **תקנון checkbox was CSS-hidden** in `brand-skin.css`. Live Cardcom still required it (`יש לסמן קריאה והסכמה לתקנון`) with no box. Unhidden. Label is Cardcom `condition.label` / `condition.value` (language follows Create). Full-width row above pay. Checkbox sits **next to** the link (not stretched across the row). Do not hardcode one language.

2. **Error bar was kissing the SSL box.** `.errorDiv` now has `margin-bottom: 20px`.

3. **Wallet extra empty grid rows** (placement stubs) are hidden when they have no button. Grid is `min-content`. Local 2×2 is ~90px tall.

4. **Logo + `{company_name}`** are back. Do not crop the PNG. Do not put “Aviv Ozeri” in the customer-facing name.

5. **Card number grouped format (4-4-4-4) is not possible** on live Cardcom. No JS in paste. Mobile field is Cardcom `type="number"` (cannot contain spaces). `checkCreditCardBrand` only sets the brand icon class. Do not fake it in CSS. Do not inject spaces that would break PAN validation.

Vercel mock already has 1–4. **Live `e.cardcom.solutions` still has the old paste** until Aviv runs `cardcom export` and pastes HTML + RTL CSS + LTR CSS.

---

## Tester / Vercel

- **https://cardcom-tester.vercel.app** — production alias, just updated
- New version iframe frames: **520×800** and **520×960** (card stays 520px; do not stretch the form to a wide iframe)
- Old version keeps 1180 / 900 / 640
- Local embed hides `#preview-wallet-bar`
- `POST /payment` → Cardcom Create (env vars on Vercel). Logo on live Cardcom will stay broken until there is an HTTPS logo URL.

---

## Still open (Aviv wants your next-step call)

Tell him what to do **now**, in order. Open items:

1. **Paste the new design into Cardcom** (`cardcom export` → RTL slot + LTR slot). Without this, phone screenshots of live Cardcom will keep showing the old CSS (hidden תקנון, kissing error, etc.).
2. **HTTPS logo URL** for live Cardcom (Vercel static path or other). Localhost `src` will not load on Cardcom HTTPS.
3. **Replace `{company_name}`** and terms/privacy `href="#"` with real merchant copy/URLs (Low Profile language settings + Create). Do not copy Canaan Tourism.
4. **Invoice via Create** (`Document` / hide invoice head) instead of CSS-hiding billing forever. Confirm whether Create can hide `ShowInvoiceHead`.
5. **Native app checkout** is not built. Previous plan mentioned Open Fields / Direct. Aviv wants you to push that track if Low Profile is “good enough to continue.”
6. Do **not** add paste JS. Do **not** format the PAN. Do **not** CSS-hide phone/email or empty `#GooglePayDiv`.

---

## Hard rules (repeat)

- No JS in paste HTML
- No `embed` / `object` / `frameset` / `frame` / `iframe` / `meta` / `link` / `style` in production HTML
- Do not rewrite `data-bind` or rename Cardcom IDs
- Footer is `html: labels.FooterTextTop` / `FooterTextBottom`
- Header title is `text: lph1`; CSS `:lang` overlays תשלום מאובטח / دفع آمن / Secure Payment / Безопасная оплата
- Parent iframe needs `allow="payment"` and `allowpaymentrequest`
- Promote `_brand/` to canonical only when Aviv says paste
