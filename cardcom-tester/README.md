# CardCom tester shell

React + Vite app that creates a Cardcom Low Profile session and embeds the hosted payment page.

This is **not** the Cardcom checkout UI. Paste-ready HTML + CSS live in [`../templates/cardcom/low-profile/`](../templates/cardcom/low-profile/).

- From the repo root: `source scripts/cardcom-clipboard.zsh` then `cardcom_tester`
- Live UI: language (`he` `en` `ar` `ru`) + mode (redirect new tab / iframe overlay) + **Open checkout** → `POST /payment`
- Local HTML/CSS preview is still `cardcom_open`, not these buttons

The overlay iframe sets `allow="payment"` and `allowpaymentrequest` (Cardcom’s Google Pay iframe requirement). Do not add JavaScript that reaches into the payment iframe.
