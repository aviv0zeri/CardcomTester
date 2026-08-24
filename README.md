# CardcomTester

Test harness for Cardcom Low Profile payments.

## Plan (web vs mobile)

- **Web Cardcom** — Cardcom hosts a Low Profile page. Custom look is **static HTML + CSS only**. No JavaScript or React inside that page.
- **React app** (`cardcom-tester/`) — outer shell / test harness only. It creates a payment session and embeds Cardcom. It must not touch the iframe DOM.
- **Node API** (`server/`) — shared across all clients. `POST /payment` creates a Cardcom session using a **payment profile** (project, account, terminal, redirects, optional CSS URL).
- **Mobile Cardcom** — separate native/direct integration, to be researched later. Do not reuse the web Low Profile page as the mobile UI.
- **Payment methods** — shown or hidden by Cardcom terminal / template / API config, not by React and not by CSS `display: none` on real methods.

## Static checkout files

Edit and paste from **`cardcom-production/`**. Local visual development is **`cardcom-preview/`**.

```
cardcom-production/iframe.html   ← paste into Cardcom iframe HTML
cardcom-production/checkout.css  ← paste into Cardcom CSS
```

```bash
cardcom_html    # HTML pane first
cardcom_css     # CSS pane second
```

Preview (serve the repo root, not a subfolder):

```bash
python3 -m http.server 8080
```

http://127.0.0.1:8080/cardcom-preview/

`cardcom-preview/` uses mock JS and stand-in assets because Cardcom's runtime is not on localhost. **Never paste that folder into Cardcom.**

The React app (`cardcom-tester/`) only creates a session and embeds Cardcom. It must not touch the iframe DOM.

Older files under `cardcom-hosted/` are leftover from earlier experiments. Do not edit them for new work.

## Wallet buttons

The hosted template keeps Bit, Apple Pay, Google Pay, and PayPal.

Apple Pay is gated by Cardcom (typically Safari + an Apple Wallet). In Chrome the Apple Pay node is often still in the page but hidden, which used to leave a hole in a 4-column row. The CSS now collapses that empty slot so the visible buttons share the row.

Safari with Apple Pay active still shows four equal buttons.

## How to run

1. API: `cd server && node index.js` → http://localhost:3000
2. Shell: `cd cardcom-tester && npm run dev` → http://localhost:5173

Click **Test Payment** on 5173 to create a new Cardcom session and embed the hosted page.

Credentials stay in `server/.env` (`CARDCOM_USERNAME`, `CARDCOM_TERMINAL`). Do not commit that file.

Optional: `CARDCOM_CSS_URL` on the tester profile. Production CSS should be pasted into Cardcom’s editor; then leave `CARDCOM_CSS_URL` empty. Localhost CSS is blocked as mixed content on Cardcom’s HTTPS page.

After any CSS change, start a **new** payment. Old Low Profile URLs keep the old stylesheet.

## Layout

- `cardcom-hosted/` — portable Cardcom HTML/CSS (web checkout source of truth)
- `server/` — shared payment API and `profiles.js`
- `cardcom-tester/` — React test harness / design-prototype shell
