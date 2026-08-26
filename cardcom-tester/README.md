# CardCom tester shell

React + Vite app with two tabs:

1. **API lab** — Create Low Profile → pay on Cardcom → GetLpResult. Developer laboratory, not a production admin.
2. **Design** — Local mock vs live Cardcom Low Profile, languages, page / iframe / phone.

This is **not** the Cardcom checkout UI. Paste-ready HTML + CSS live in [`../templates/cardcom/low-profile/`](../templates/cardcom/low-profile/).

- From the repo root: `source scripts/cardcom-clipboard.zsh` then `cardcom tester`
- Express: `cd server && node index.js` (port 3000)
- Vite: `cd cardcom-tester && npm run dev` → http://127.0.0.1:5173
- `cardcom export` copies the new version (Aviv brand) HTML, then CSS (`rtl`/`ltr` + `brand-skin.css`)

The overlay iframe sets `allow="payment"` and `allowpaymentrequest` (Cardcom’s Google Pay iframe requirement). Do not add JavaScript that reaches into the payment iframe.
