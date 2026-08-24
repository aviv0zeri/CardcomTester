# Asset inventory — Cardcom hosted checkout

Every external reference in `test.css` / `test-preview.css`, where it comes from, and whether you have to do anything about it.

**Bottom line: you do not need to upload a single image to Cardcom.** The design either uses Cardcom's own hosted assets, uses images Cardcom injects at runtime, or hides the image entirely. All statuses below were checked with `curl` on 2026-08-24.

## 1. Nothing to upload — and here's why

The one asset you'd expect to need is the Print House logo. The design doesn't use an image for it. `test.css` hides Cardcom's logo `<img>` and draws the gem mark from an embedded font glyph instead:

```1585:1587:cardcom-hosted/test.css
.header .headerIn .logoDiv img {
    display: none;
}
```

The mark comes from `.logoDiv::before { content: '•'; font-family: 'PrintHouseSymbols' }`, and the wordmark from `.header .headerIn::before/::after`. So the header is pure text plus a font glyph. The footer's Cardcom logo is hidden the same way via `.footer .footerIn .footer-logo { display: none }`.

That is why the shared image library in Cardcom's **העלאת תמונות** screen is irrelevant here — those are other people's uploads, and this design references none of them.

## 2. Images Cardcom injects at runtime

These are bound in `test.html` and Cardcom supplies the URL. Never hardcode them.

| Binding | Element | Notes |
| --- | --- | --- |
| `attr: { src: images.companyLogo }` | header `.logoDiv img` | **Hidden by the design** (font glyph instead) |
| `attr: { src: images.cardcomLogoEn }` | `.footer-logo img` | **Hidden by the design** |
| `attr: { src: images.paypal }` | `.paypalDiv img` | Official PayPal artwork |
| `attr: { src: images.masterPass }` | `.masterPassDiv img` | Legacy, effectively unused |
| `attr: { src: images.questionIcon }` | CVV help icon | **Hidden by the design** (`a.WhatIsCvvLightBox`) |
| `attr: { src: CardcomBitQrBarcodeUrl }` | `#qrBarcode` | Bit QR, generated per transaction |

Google Pay and Apple Pay draw their own buttons — Google's SDK injects into `#GooglePayDiv`, Safari renders the native `-apple-pay-button`. There is no image to host for either.

## 3. Cardcom-hosted assets referenced by `test.css`

Root-relative paths resolve against `secure.cardcom.solutions` on the live page and **404 on localhost** — that is the entire reason wallet buttons look blank in local preview. `test-preview.css` re-points the ones that matter to absolute URLs.

| URL | Status | Used for |
| --- | --- | --- |
| `/Images/Bit/bit_button.svg` | 200, 7.6 KB | Bit button artwork |
| `/Images/Bit/bit_button_hover.svg` | 200, 7.6 KB | Bit hover state |
| `/Images/PayPal/PayPalHe.png` | 200, 4.6 KB | PayPal artwork (preview only) |
| `/Images/LowProfile5/check-mark.svg` | 200, 343 B | Validation success mark |
| `/Images/LowProfile5/house-chimney.svg` | 200, 708 B | "Back to site" link icon |
| `/Images/LowProfile5/previous.svg` | 200, **130 KB** | Back arrow — oversized for an arrow |
| `/Images/LowProfile5/paymentDetailsBg.jpg` | 200, 68 KB | Stock background, **overridden** by the design |
| `/Images/LowProfile5/paymentDetailsBgNew.jpg` | 200, 47 KB | Stock background, **overridden** |
| `/Images/LowProfile5/hand.jpg` | 200, 38 KB | Stock decoration, **overridden** |
| `/Images/2015/ajax-loader.gif` | 200, 673 B | Popup spinner (hardcoded in `test.html`) |
| `/Images/visamasterpic.gif` | 200, 10.7 KB | CVV help image, **hidden by the design** |

### Broken on Cardcom's own host

These five are referenced by Cardcom's stock CSS for the card-brand indicator and return **404 even on `secure.cardcom.solutions`**, so the feature is broken on the live page too. Not ours to fix, but don't be surprised when no brand icon appears as a card number is typed:

```
/Images/LowProfile5/credit-card.png    404
/Images/LowProfile5/visa.png           404
/Images/LowProfile5/mastercard.png     404
/Images/LowProfile5/amex.png           404
/Images/LowProfile5/diners.png         404
```

## 4. Fonts

| Family | Delivery | Status |
| --- | --- | --- |
| `SimplerPro` | embedded `data:` URI | 43 KB of base64 |
| `HadassahFriedlaender` | embedded `data:` URI | **126 KB** of base64 |
| `PrintHouseSymbols` | embedded `data:` URI | 3 KB of base64 — this is the header gem mark |
| `Assistant` | `fonts.gstatic.com` | 200 |
| `FrankRuhlLibre` | `fonts.gstatic.com` | 200 |

The three Print House faces are inlined because their origin serves woff2 without CORS headers, so cross-origin `@font-face` is blocked while `data:` URIs are not.

The cost is real and worth deciding on deliberately: **171,861 of `test.css`'s 221,730 characters — 77% — is font payload.** Every page load pays for it, and it cannot be cached separately from the stylesheet. Two things to weigh before going live:

- **Licensing.** SimplerPro and Hadassah Friedlaender are commercial faces, and base64-inlining them in a public stylesheet redistributes the font files in a form anyone can trivially extract. Worth confirming the licence permits it.
- **Hosting instead.** Any HTTPS origin you control with permissive CORS would let these load as normal `@font-face` URLs and be cached independently, cutting the stylesheet by ~77%.

## 5. Preview-only URLs

`test-preview.css` is local scaffolding and never goes into Cardcom. It references Cardcom's own `bit_button.svg`, `bit_button_hover.svg`, and `PayPalHe.png` absolutely, plus Google's official `dark_gpay.svg` (200, 1.8 KB) as a stand-in for the SDK button.

## 6. If you ever do need to upload something

Use **העלאת תמונות** in the same Cardcom design screen. It returns a URL shaped like:

```
https://secure.cardcom.solutions/LoadImage.ashx?c=1&g=<guid>
```

That is the right home for anything custom, since it is same-origin with the payment page and needs no external host or CORS handling.
