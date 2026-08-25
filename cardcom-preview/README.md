# Cardcom local preview

Visual sandbox for `../templates/cardcom/low-profile/`.

This folder may use mock JS, mock labels, and stand-in wallet assets because Cardcom’s runtime does not exist on localhost. Mocks may be interactive for layout checks; they still only **simulate** Cardcom. Saved-card Google Pay, native Apple Pay, and real Bit/PayPal clicks come from a live Low Profile session.

Production Bit CSS uses `/Images/Bit/bit_button.svg`. Localhost maps that path to `assets/bit_button.svg` (Express) and `Images/Bit/` at the repo root (python `http.server`). The slots use the same production CSS grid.

**Never paste anything from this folder into Cardcom.**

## Run

From the repo root:

```bash
python3 -m http.server 8080
```

Or use the React tester at http://localhost:5173 (three sections: redirect page, iframe-only, either).

The wrappers load Cardcom stock CSS, then shared `templates/cardcom/low-profile/checkout.html` with `rtl/` or `ltr/` CSS. `mock.js` (and language-specific mocks) fill demo labels, including `lph1`. `preview-wallets.js` only hides wallets to preview 4/3/2/1 reflow (`?wallets=3`). `html.checkout-embed` is local-only and must not be pasted.
