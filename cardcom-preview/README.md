# Cardcom local preview

Visual sandbox for `../templates/cardcom/`.

This folder may use mock JS, mock labels, and stand-in wallet assets because Cardcom’s runtime does not exist on localhost.

**Never paste anything from this folder into Cardcom.**

## Run

From the repo root:

```bash
python3 -m http.server 8080
```

Or use the React tester at http://localhost:5173 (three sections: redirect page, iframe-only, either).

The wrappers load Cardcom stock CSS, then a file from `templates/cardcom/`. `mock.js` fills demo labels, line items, and wallet stand-ins. `html.checkout-embed` is local-only and must not be pasted.
