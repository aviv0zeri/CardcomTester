# Cardcom local preview

Visual sandbox for `../cardcom-production/`.

This folder may use mock JS, mock labels, and stand-in wallet assets because Cardcom’s runtime does not exist on localhost.

**Never paste anything from this folder into Cardcom.**

## Run

From the repo root:

```bash
python3 -m http.server 8080
```

Open http://127.0.0.1:8080/cardcom-preview/

The page loads Cardcom stock CSS, then `cardcom-production/checkout.css` (same order as their platform). It fetches `cardcom-production/iframe.html`, and `mock.js` fills demo labels, line items, and wallet stand-ins.
