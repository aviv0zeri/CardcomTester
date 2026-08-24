# Cardcom hosted checkout (static HTML + CSS)

**Folder:** `cardcom-hosted/`

Cardcom hosts the payment page. Their editor accepts **static HTML and CSS only** — no React, no custom JavaScript, no touching the iframe's DOM from outside. The React app's only job is to create the session and point an `<iframe>` at the URL Cardcom returns.

## Build it, don't hand-edit it

Everything Cardcom receives is generated:

```bash
./build.sh
```

| Input | | Output (never hand-edit) |
| --- | --- | --- |
| `templates/iframe-stock.html` | → `apply-edits.py` → | `paste/iframe.body.html` |
| `templates/cardcom-stock.css` + `checkout.css` | → concatenated → | `paste/checkout.full.css` |
| both of the above | → | `iframe-preview.html` (local only) |

`build.sh` also fails loudly on unbalanced CSS braces, because a single stray brace silently swallows every rule after it and the only symptom is "some of my CSS stopped working".

Copy to the clipboard with the shell helpers in [`../scripts/cardcom-clipboard.zsh`](../scripts/cardcom-clipboard.zsh), which rebuild first so the clipboard can never be stale:

```bash
cardcom_html   # → iframe HTML pane
cardcom_css    # → CSS pane
```

## Paste order matters

**HTML first, CSS second.** Loading an HTML template in Cardcom's editor resets the CSS pane to Cardcom's stock stylesheet. Paste the CSS first and the HTML load will wipe it, and the page comes back looking like plain Cardcom — blue links, grey product table, boxed inputs. That is not a bug in the design; it is the CSS pane having been reset.

**Never press F5 on the preview window.** Cardcom's own editor screen says this. Refreshing re-injects the template instead of replacing it, which duplicates nodes — you get titles rendered twice and phantom empty rows. Close the preview window and reopen it from **פתח דף תצוגה מקדימה** instead.

## Why the CSS is shipped whole

`checkout.css` contains overrides only. On its own it produces a half-styled page, because it never restates the parts of Cardcom's stock stylesheet it is happy with. So `build.sh` concatenates stock + overrides into `paste/checkout.full.css` and that single file is what gets pasted. There is then no ordering to remember inside the pane and no way to apply half of it.

This also means overriding stock means beating stock's specificity, which is often higher than it looks. Rules like `.blockDetailsIn .formRow .fieldInput select.mini` are four classes deep, so a three-class override loses silently and the control keeps its hardcoded pixel width. Several comments in `checkout.css` mark where that bit us.

## Files

| File | What it is |
| --- | --- |
| [`build.sh`](./build.sh) | Regenerates everything in `paste/` and the preview. Run this, not the pieces. |
| [`checkout.css`](./checkout.css) | **The design.** Overrides on top of Cardcom's stock stylesheet. Edit this. |
| [`apply-edits.py`](./apply-edits.py) | Applies our HTML edits to any pristine Cardcom template. Additive only; refuses to write if a `data-bind` or `id` went missing. |
| [`templates/`](./templates/) | Pristine Cardcom templates and stock CSS, unmodified. See [`templates/README.md`](./templates/README.md). |
| `paste/` | Generated. Paste these into Cardcom. Never hand-edit — `build.sh` overwrites them. |
| [`preview.css`](./preview.css) | Local preview only. **Never paste into Cardcom.** Simulates the runtime, nothing more. |
| `iframe-preview.html` | Generated local preview. Open it in a browser to judge layout. |
| [`ASSETS.md`](./ASSETS.md) | Every external asset the CSS references, and which ones you must host. Short answer: none. |

Older, superseded files also live here: `checkout.html`, `test.html`, `test.css`, `test-preview.css`, `index.html`, `paste/checkout.body.html`, `paste/test.body.html`. They are the standard-template and Print House lineages from before the build existed. Nothing generates or consumes them now.

### What the local preview can and cannot tell you

It loads `paste/checkout.full.css` — byte for byte what Cardcom gets — so **the look is real**. What is missing is the runtime. Knockout is not running, so every `data-bind` is inert, and the wallet SDKs are not running, so Google, Apple and PayPal draw nothing at all. `preview.css` fakes just enough of that to make layout judgeable: stand-in label text, stand-in wallet artwork, and hiding the nodes Knockout would resolve.

Never conclude anything about **behaviour** from the preview, and above all never conclude a payment method is unavailable. Availability is decided by terminal config, not CSS.

## Wallet buttons

**You do not design these buttons. You size their box.** Each provider renders its own artwork and brand rules require the official asset. Never hand-draw a wallet logo.

| Button | Who draws it | How you control it |
| --- | --- | --- |
| Google Pay | Google's SDK renders into `#GooglePayDiv` | `UIDefinition.GooglePayBtnDesign` on the API. Do not recolour it in CSS. |
| Apple Pay | Safari's native `-apple-pay-button` | `-apple-pay-button-style` / `-apple-pay-button-type`. Cardcom's `.logo` span is the mark elsewhere. |
| Bit | Cardcom's `Images/Bit/bit_button.svg` (201×56, `#00353B`) | Size the button; the background colour matches the asset so it letterboxes cleanly. |
| PayPal | Cardcom injects the official PayPal image into `.paypalDiv img` | Size the `img`. The gold button is part of the artwork. |

Official artwork is 200–328px wide, so buttons sit **two-up and wrap** rather than being squeezed into four narrow slots.

### The placement hooks are not inert

`#ApplePayDivContainer` and `#BitDivContainer` look like empty stubs, and Cardcom's template even comments them as "place this div anywhere for manual placement". **Cardcom's JS moves the live buttons into them.** An unconditional `display: none !important` on these two is what made the Apple Pay button vanish from the live page, and it took a while to find because the button was rendering fine — into a hidden container.

They are now collapsed only while genuinely empty:

```css
#ApplePayDivContainer:not(:has(*)),
#BitDivContainer:not(:has(*)) { display: none !important; }
```

`:not(:has(*))` rather than `:empty`, because they contain a comment node and whitespace, which `:empty` counts as content.

If a wallet button goes missing again, `cardcom_html plain` pastes the same template without the `.paymentOptionsRow` wrapper. That wrapper is the only edit that changes the DOM shape, so it is the one-swap test: if the button comes back, the wrapper is the cause; if not, look at the terminal config.

## Two wrappers we add ourselves

`apply-edits.py` adds two `div`s that are not in Cardcom's stock template. Neither carries a `data-bind`, so Cardcom ignores them, but **the CSS does nothing without them** — every rule targeting them matches zero elements, which fails invisibly rather than loudly.

| Wrapper | Wraps | Why |
| --- | --- | --- |
| `.checkoutWalk` | `.OrderDetails` → `.paymentDetails` | Two panes: billing and payment. Stacked in a narrow iframe, side by side on a full-width page. A real step-by-step walkthrough needs JavaScript we cannot add. |
| `.paymentOptionsRow` | `.paypalDiv` → `.masterPassDiv` | Confines the wrapping two-up layout to the wallets. |
| `.payBar` | `.submitDiv` + `.errorDiv` | Pins the button and the error list as one unit. Pinned separately, a decline scrolls away from the button it is telling the customer to press again. |

## The pinned pay button

The page scrolls normally and `.payBar` is pinned with `position: sticky; bottom: 0`. Two earlier approaches are worth not repeating:

- **A flex chain rooted at `.page`.** `.page` exists only in our old local preview file, not in any template Cardcom ships. With the chain broken, the `overflow: hidden` it depended on survived on its own and everything below the fold became unreachable.
- **`overflow-x: hidden` on `body`.** Looks harmless, but `overflow-x: hidden` forces `overflow-y` to compute to `auto`, which makes `<body>` a scroll container. Sticky then measures itself against `<body>`, which never scrolls, and the bar silently stops pinning. **Do not declare overflow on `html` or `body`.**

Sticky needs no ancestor chain and no fixed heights, so it behaves the same loaded directly or inside the React iframe. The one thing it cannot tolerate is a scrolling ancestor between it and the viewport.

## How error messages work

The page ships no JavaScript of yours, but it is not a page without JavaScript. Cardcom loads Knockout and their own scripts on top of your markup, and `data-bind` is where those attach. `.errorDiv` is a live template: Cardcom pushes declines, validation failures and 3DS errors into `error.messages`, Knockout clones the `<li>` once per message and `visible:` turns the container on.

Error handling is therefore free — you only have to leave the socket reachable:

- **Never `display: none` the `.errorDiv`.** It does not stop the failure, it stops the customer learning why the payment failed.
- **Never `display: block !important` it either.** Knockout implements `visible:` by writing an inline `style="display: none;"`, and an unguarded `!important` outranks inline styles, so the box would be pinned permanently open and show empty on every load. The CORRECTIONS rules are guarded with `:not([style*="display: none"])`, which applies our styling only while Knockout is not hiding the element.
- The `style="display: none;"` that `apply-edits.py` puts on `.errorDiv` is the same value Knockout writes when there are no messages. It is the correct start state and stops an empty box flashing before Knockout binds.

## Labels and placeholders

**Every field gets both.** `apply-edits.py` adds a `placeholder` to every `<input>` it knows about, and `checkout.css` never hides `.fieldName`.

That redundancy is deliberate, and it is the third attempt at this. Hiding `.fieldName` outright left the rows CSS cannot relabel anonymous — a `<select>` takes no placeholder, so expiry, instalments and the terms agreement became bare controls. Hiding it only where a placeholder existed fixed those, but any field the transform did not know about, and any custom field a terminal adds later, still arrived as an unlabelled underline. Labels are now never hidden, so an unknown field degrades to "labelled but no placeholder" instead of "anonymous".

Rows stack — label above, control below, both full width. Stock puts them side by side with the label in a fixed 183px gutter, which makes rows with and without labels visibly different widths.

## The CORRECTIONS section in `checkout.css`

The bottom of the file reverses `display: none` rules that break payment rather than restyle it. They rely on coming **after** any other design CSS in source order, which the concatenated build guarantees.

| What was hidden | Why that breaks things |
| --- | --- |
| `.errorDiv` | Customer never learns why a payment failed. |
| the terms checkbox row | Renders unchecked, so the customer clicks pay against a validation error they cannot see. Cardcom already hides this row itself when the terminal has no agreement configured. |
| the total | `.productsDetails` is the only place Cardcom prints it, so the amount is echoed into the credit-card title via `.creditTitleTotal`, bound to Cardcom's own `summaryTotalSign`. |
| `#privacy-policy-container` | Legal exposure, and a design-approval risk. |

## Cardcom's rules (from their editor page)

From **עיצוב מותאם אישית CSS ו-HTML גרסה 5**. Breaking these breaks payments.

1. **Never edit `data-bind`.** To remove an element, use `display: none`.
2. **Keep the footer wording** `הסליקה מתבצעת דרך קארדקום`. It comes from `labels.FooterText*`, so leave the bindings alone rather than hardcoding it.
3. **3D Secure:** the cardholder **phone** (`#txtCardOwnerPhone`) or **email** (`#txtCardOwnerEmail`) must stay visible. Hide both and the transaction **fails**.
4. The preview window opens **blank**. Leave it open and never press F5.
5. The editor has a **timer**. Save a draft as you go.
6. Design changes need approval via **הגש עיצוב לאישור**, unless the account auto-approves.
7. The HTML pane rejects `embed`, `object`, `frameset`, `frame`, `iframe`, `meta`, `link` and `style` **tags**. Inline `style=""` attributes are fine — only the `<style>` element is banned, and Cardcom's own template uses inline styles. Files in `paste/` are body fragments already checked against this list.

## How to apply in Cardcom (step by step)

1. **בחר כיוון עריכה** → `ימין לשמאל (עברית וערבית)`.
2. **סוג העריכה** → `CSS ו-HTML`.
3. **בחר שפה להצגה** → `עברית`.
4. **פתח דף תצוגה מקדימה**. A blank window opens. Leave it open, no F5.
5. **התחל עריכה**.
6. `cardcom_html` → paste into the **iframe** HTML pane. (Cardcom's **בחר HTML לטעינה** dropdown holds more than one template. The React shell embeds the page with `<iframe src={paymentUrl}>`, so the iframe variant is the one that matters.)
7. `cardcom_css` → paste into the CSS pane. This must come after step 6.
8. Watch the preview window update live. Do not refresh it.
9. Save a draft, then save changes.
10. Submit **הגש עיצוב לאישור** if the account needs approval.
11. Set `CARDCOM_CSS_URL` to empty in `server/.env` so the API stops overriding the terminal CSS with the test gist.
12. Create a **new** payment from the React shell. Existing Low Profile URLs keep the stylesheet they were created with.

### Editing a different template variant

```bash
python3 apply-edits.py <pristine-template.html> paste/<name>.body.html
```

It strips the document wrapper, adds the placeholders, wraps the wallets and the pay bar, echoes the total into the credit-card title, and sets the `.errorDiv` inline default. Matching works on either `id` or `data-testid`, because the two disagree across variants — the card number field is `id="txtCardNumber"` but `data-testid="credit-card-number-text-field"`.

Known quirks of the iframe template specifically: it has **no header**, its footer is nested differently (`.footerIfIframe` holds two mutually exclusive footers, and the fallback is *not* inside a `.footer`, so `.footer .footerIn` misses it), and its two card-number inputs **share the id `txtCardNumber`**. That duplicate id is Cardcom's, not ours; select those two by `data-testid`.

### Hosting images

Use **העלאת תמונות** on the same screen. Cardcom returns a URL like `https://secure.cardcom.solutions/LoadImage.ashx?c=1&g=<guid>`.

Assets referenced by the CSS resolve on Cardcom's own domain, not ours: `url(/Images/Bit/bit_button.svg)` is root-relative, so it 404s on `127.0.0.1` and 200s on `secure.cardcom.solutions`. Nothing needs uploading for this design — see [`ASSETS.md`](./ASSETS.md).

## Required IDs (do not rename)

Wallets: `#ApplePayDivContainer`, `#apple-pay-button-setup`, `#apple-pay-button-start`, `#apple-pay-button-popup`, `#apple-pay-notices`, `#GooglePayDiv`, `#BitDivContainer`, `#uPayBitDiv`, `#bit-payment-button`, `#PayMeBitDiv`, `#CardcomBitDiv`, `.paypalDiv`, `.ApplePayDiv`, `.masterPassDiv`

Card: `#CreditCardDiv`, `#txtCardNumber`, `#validityYear`, `#validityMonth`, `#txtCvv`, `#txtTZ`, `#txtCardOwnerName`, `#txtCardOwnerPhone`, `#txtCardOwnerEmail`

Other: `#txtopenSum`, `#captcha_div`, `#captcha_container`, `#privacy-policy-popup`, `#PopUpRTL`, `#PopUpLTR`

3DS is Cardcom-owned (`Cardcom3DSecure*.js` on their page). Do not add a custom 3DS form.
