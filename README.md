# CardcomTester

Test harness for Cardcom Low Profile payments.

## Plan (web vs mobile)

- **Web Cardcom** — Cardcom hosts a Low Profile page. Custom look is **static HTML + CSS only**. No JavaScript or React inside that page.
- **React app** (`cardcom-tester/`) — outer shell / test harness only. It creates a payment session and embeds Cardcom. It must not touch the iframe DOM.
- **Node API** (`server/`) — shared across all clients. `POST /payment` creates a Cardcom session using a **payment profile** (project, account, terminal, redirects, optional CSS URL).
- **Mobile Cardcom** — separate native/direct integration, to be researched later. Do not reuse the web Low Profile page as the mobile UI.
- **Payment methods** — shown or hidden by Cardcom terminal / template / API config, not by React and not by CSS `display: none` on real methods.

## Three checkout versions (what to paste into Cardcom)

Paste **only** from `templates/cardcom/`. Never paste `cardcom-preview/` (mocks, wrappers, `html.checkout-embed`).

HTML first, then CSS. Loading HTML in Cardcom’s editor resets the CSS pane. Do not F5 their preview window — close it and reopen it.

### 1. Redirect — full page

Use when the shop **sends the customer to Cardcom’s page** (the checkout is the whole window and may scroll).

| Language | HTML | CSS |
| --- | --- | --- |
| Hebrew | `templates/cardcom/redirect-normal/hebrew/iframe.html` | `templates/cardcom/redirect-normal/hebrew/checkout.css` |
| English | `templates/cardcom/redirect-normal/english/iframe.html` | `templates/cardcom/redirect-normal/english/checkout.css` |

Local tester: **Redirect — full page** (leaves the React app).

### 2. Iframe only

Use when the shop **embeds Cardcom in an iframe**. Compact layout, no nested page scrollbar. The order table may still scroll internally.

| Language | HTML | CSS |
| --- | --- | --- |
| Hebrew | `templates/cardcom/iframe-normal/hebrew/iframe.html` | `templates/cardcom/iframe-normal/hebrew/checkout.css` |
| English | `templates/cardcom/iframe-normal/english/iframe.html` | `templates/cardcom/iframe-normal/english/checkout.css` |

Local tester: **Iframe only**.

### 3. Either — same HTML/CSS

Hebrew and English **redirect-normal** files also include compact iframe rules, switched on locally by wrapping the preview in `html.checkout-embed` (React **Either** section). That class is **preview-only**.

On Cardcom you cannot set `html.checkout-embed`. For a live iframe, paste **iframe-only** (section 2). For a live redirect page, paste **redirect** (section 1).

A frozen copy of English redirect (before dual-mode CSS) is `templates/cardcom/redirect-normal/english-full/`.

## Export to clipboard

```bash
source scripts/cardcom-clipboard.zsh

cardcom_export    # fzf: any version, HTML or CSS
cardcom_html      # fzf: HTML only (paste first)
cardcom_css       # fzf: CSS only (paste second)
```

Needs [fzf](https://github.com/junegunn/fzf).

## Local preview

`cardcom-preview/` is a visual sandbox. **Never paste that folder into Cardcom.**

```bash
python3 -m http.server 8080
```

http://127.0.0.1:8080/cardcom-preview/

Or the React tester: API `cd server && node index.js`, then `cd cardcom-tester && npm run dev` → http://localhost:5173

The tester has the same three sections as above. Redirect full-page buttons navigate away; iframe and Either open an overlay. Do not touch the iframe DOM.

Older files under `cardcom-hosted/` are leftover from earlier experiments. Do not edit them for new work.

## Wallet buttons

The hosted template keeps Bit, Apple Pay, Google Pay, and PayPal.

Apple Pay is gated by Cardcom (typically Safari + an Apple Wallet). Wallet availability is terminal + Knockout, not CSS.

## How to run

1. API: `cd server && node index.js` → http://localhost:3000
2. Shell: `cd cardcom-tester && npm run dev` → http://localhost:5173

Credentials stay in `server/.env` (`CARDCOM_USERNAME`, `CARDCOM_TERMINAL`). Do not commit that file.

Optional: `CARDCOM_CSS_URL` on the tester profile. Production CSS should be pasted into Cardcom’s editor; then leave `CARDCOM_CSS_URL` empty. Localhost CSS is blocked as mixed content on Cardcom’s HTTPS page.

After any CSS change, start a **new** payment. Old Low Profile URLs keep the old stylesheet.

## Layout

- `templates/cardcom/` — paste-ready HTML/CSS (redirect-normal, iframe-normal)
- `cardcom-preview/` — localhost mock wrappers (never paste)
- `server/` — shared payment API and `profiles.js`
- `cardcom-tester/` — React test harness
