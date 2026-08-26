# CardcomTester

Test harness for Cardcom Low Profile payments.

## Plan (web vs mobile)

- **Web Cardcom** — Cardcom hosts a Low Profile page. Custom look is **static HTML + CSS only**. No JavaScript or React inside that page.
- **React app** (`cardcom-tester/`) — outer shell / test harness only. It creates a payment session and embeds Cardcom. It must not touch the iframe DOM.
- **Node API** (`server/`) — shared across all clients. `POST /payment` creates a Cardcom session using a **payment profile** (project, account, terminal, redirects, optional CSS URL).
- **Mobile Cardcom** — separate native/direct integration, to be researched later. Do not reuse the web Low Profile page as the mobile UI.
- **Payment methods** — shown or hidden by Cardcom terminal / template / API config, not by React and not by CSS `display: none` on real methods.

## Checkout versions (what to paste into Cardcom)

Paste **only** from `templates/cardcom/low-profile/`. Never paste `cardcom-preview/` (mocks, wrappers, `html.checkout-embed`).

HTML first, then CSS. Loading HTML in Cardcom’s editor resets the CSS pane. Do not F5 their preview window — close it and reopen it.

Cardcom stores **two** custom designs by editor direction, not four languages. Paste the **same HTML** into both slots. Create `Language` (`he` / `en` / `ar` / `ru`) only fills Knockout labels.

| Cardcom slot | Direction | HTML | CSS |
| --- | --- | --- | --- |
| עברית וערבית | RTL | `templates/cardcom/low-profile/checkout.html` | `templates/cardcom/low-profile/rtl/checkout.css` |
| אנגלית ושפות נוספות | LTR | `templates/cardcom/low-profile/checkout.html` | `templates/cardcom/low-profile/ltr/checkout.css` |

Field presence is Cardcom Low Profile config/API (`UIDefinition` and הגדרות לפי שפה), not CSS. Header wording per language is `lph1` / הגדרות לפי שפה, not hardcoded HTML. `labels.PayByCreditCard` is English in Cardcom’s Arabic/Russian/Portuguese packs; paste CSS fills those via `:lang()`.

`html.checkout-embed` is localhost preview. Live Cardcom iframe uses the same compact rules at `@media (min-width: 600px) and (max-width: 980px)` (no page scrollbar). Wide redirect still scrolls.

Former iframe-specific CSS is parked at `templates/cardcom/low-profile/_archive/old-separate-iframe/` until we confirm Cardcom’s stored design slot. A frozen English snapshot is `_archive/english-full-snapshot/`. Do not paste archives.

## Export to clipboard

```bash
source scripts/cardcom-clipboard.zsh

cardcom export    # new version (Aviv brand): HTML first, then CSS
cardcom tester    # start Express + Vite if needed, open the React tester
cardcom_export    # old version: fzf, Enter copies and stays in the list, Esc quits
cardcom_html      # old version, HTML only (paste first)
cardcom_css       # old version, CSS only (paste second)
cardcom_open      # fzf: open that version's HTML+CSS on localhost (not React)
```

Needs [fzf](https://github.com/junegunn/fzf). `cardcom_open` uses the API server on port 3000 if it is running, otherwise it starts `python3 -m http.server 8080` at the repo root. `cardcom tester` needs Express on :3000 (not a python preview) and Vite on :5173.

## Local preview

`cardcom-preview/` is a visual sandbox. **Never paste that folder into Cardcom.**

```bash
python3 -m http.server 8080
```

http://127.0.0.1:8080/cardcom-preview/

Or the React tester: API `cd server && node index.js`, then `cd cardcom-tester && npm run dev` → http://localhost:5173

The React page has two tabs: **API lab** (Create → pay → GetLpResult) and **Design** (Local / live Cardcom, page / iframe / phone). Do not touch the iframe DOM.

Older files under `cardcom-hosted/` are leftover from earlier experiments. Do not edit them for new work.

## Wallet buttons

The CSS only places and sizes the outer slots (2-column grid; leftover methods reflow).

| Method | What we keep | Design |
| --- | --- | --- |
| Google Pay | `#GooglePayDiv` | `GooglePayBtnDesign` on Create (`server/profiles.js`). Iframe parent: `allow="payment"` + `allowpaymentrequest`. |
| Apple Pay | Cardcom Apple Pay IDs / `data-bind` | Terminal + Safari. Iframe needs the embedding domain registered. No `ApplePayBtnDesign`. |
| PayPal | Cardcom PayPal markup | No PayPal design API. |
| Bit | empty `#bit-payment-button` + `sendData_CardcomBit` | `/Images/Bit/bit_button.svg` and hover SVG from Cardcom’s template CSS, not an API. |

Wallet availability is terminal + Knockout, not CSS. Localhost preview simulates layout; a real Cardcom Low Profile session is what shows saved cards, native Apple Pay, and Bit clicks.

## How to run

1. API: `cd server && node index.js` → http://localhost:3000
2. Shell: `cd cardcom-tester && npm run dev` → http://localhost:5173

Credentials stay in `server/.env` (`CARDCOM_USERNAME`, `CARDCOM_TERMINAL`). Do not commit that file.

Optional: `CARDCOM_CSS_URL` on the tester profile. Production CSS should be pasted into Cardcom’s editor; then leave `CARDCOM_CSS_URL` empty. Localhost CSS is blocked as mixed content on Cardcom’s HTTPS page.

After any CSS change, start a **new** payment. Old Low Profile URLs keep the old stylesheet.

## Layout

- `templates/cardcom/low-profile/` — paste-ready Low Profile HTML + RTL/LTR CSS
- `cardcom-preview/` — localhost mock wrappers (never paste)
- `server/` — shared payment API, `profiles.js`, lab Create / GetLpResult
- `cardcom-tester/` — React test harness (design tester + API lab)
