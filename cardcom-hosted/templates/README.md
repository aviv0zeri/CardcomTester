# Cardcom templates — reference copies

This folder holds the **unmodified** Cardcom checkout template, exactly as it exists
in the Cardcom editor today. Nothing here has been fixed or improved. It is the
reference point you compare against when you change something.

If you want the *working* version with the bugs fixed, that's `../test.html` +
`../test.css` one level up. This folder is the "before".

## Files

| File | What it is | Paste into Cardcom? |
| --- | --- | --- |
| `cardcom-stock.html` | The standard checkout markup, pristine. Byte-for-byte what is in Cardcom's HTML editor. | Yes — HTML editor |
| `iframe-stock.html` | The **iframe** variant, pristine. This is the one the React shell loads. | Yes — HTML editor, iframe slot |
| `printhouse-design.css` | The Print House design layer. This is the part you own and maintain. | Yes — CSS editor |
| `cardcom-stock.css` | Cardcom's own base stylesheet. Cardcom already serves this on the live page. | No — reference only |
| `preview.html` | Local harness that renders the above so you can look at it in a browser. | Never |
| `preview.shim.css` | Local-only fakes for the things Cardcom's JavaScript does at runtime. | Never |

The CSS that currently lives in Cardcom's editor is `cardcom-stock.css` and
`printhouse-design.css` concatenated, in that order. The split point is the
`The Print House look & feel v2` banner comment. Splitting them apart is the only
change made to the CSS — no rules were edited, added, or removed.

**Verified.** These three files were diffed against the original paste as it appears
in the chat transcript, not against a reconstruction. `cardcom-stock.css` +
`printhouse-design.css` rejoins to the original byte-for-byte, and
`cardcom-stock.html` matches byte-for-byte. If the rendering looks wrong, the files
are not the cause — see the next section.

## Why this looks broken locally and fine on Cardcom

The local preview is missing most of the page, and that is not fixable by editing
CSS. The wallet buttons are **empty in the markup** and get filled in at runtime:

| Button | What the HTML actually contains | What fills it |
| --- | --- | --- |
| PayPal | `<img data-bind="attr: { src: images.paypal }">` — no `src` at all | Knockout writes `src` from the session |
| Google Pay | `<div id="GooglePayDiv"></div>` — completely empty | Google's SDK renders into it |
| Apple Pay | `-apple-pay-button` elements, no artwork | Safari draws it natively, and only for a validated merchant |
| Bit | CSS `url(/Images/Bit/bit_button.svg)` — root-relative | resolves on `secure.cardcom.solutions`, 404s anywhere else |

Every price, label, and button caption is likewise a Knockout binding with no text
in the markup. So on the live page you get four styled buttons and real values; on
`127.0.0.1` you get blank rows, because the file only ever contained bindings.

That is why the live page shows `לקוח לדוגמה`, `2026`, and `לתשלום`, while the
preview shows empty fields, `2020`, and `Go`. Same files, different runtime.

## Looking at it locally

```bash
cd cardcom-hosted
python3 -m http.server 8080
# open http://127.0.0.1:8080/templates/preview.html
```

A local preview can never be fully faithful. On the real page Cardcom's JavaScript
fills every price and label, swaps in the wallet button artwork, and wires up the
popups. Locally none of that runs, so `preview.shim.css` stands in for it: it fakes
the Knockout text, points the wallet images at real Cardcom URLs, and hides popups
that have no script to open them. Treat the preview as a layout check, not a
pixel-accurate proof.

## What the design layer weighs

`printhouse-design.css` is 188,782 characters, but only 16,906 of those are actual
CSS rules. The other 91% is three fonts embedded as base64 `data:` URIs:

- `SimplerPro` (weights 400, 700)
- `HadassahFriedlaender` (weights 400, 500)
- `PrintHouseSymbols` (weight 500)

Two more families, `Assistant` and `FrankRuhlLibre`, load from `fonts.gstatic.com`
instead. That's a third-party network request from inside a payment iframe, so it's
worth confirming Cardcom's Content-Security-Policy actually permits it — if it
doesn't, those two silently fall back and the embedded three don't.

## Known problems in this pristine version

These are real defects in the files as they stand, not preview artifacts. They are
why `../test.html` and `../test.css` exist.

**Fields have no labels.** The design hides every `.fieldName`, and the stock HTML
has no `placeholder` attributes. The result is a column of bare underlines with
nothing indicating what goes in them — you can see it in the preview. Screen
readers get no accessible name either.

**Error messages never appear.** `.errorDiv { display: none !important }` beats the
`visible:` binding Cardcom drives it with, so a declined card or a bad CVV produces
silence. The customer sees the form sit there and has no idea why.

**The terms row is hidden, and that blocks submission.** The design hides the row
with the comment "checkbox is auto-approved in the HTML". It isn't: the input is
`<input class="checkbox" type="checkbox" data-bind="checked: condition.booleanValue" />`
with no `checked` attribute anywhere, and Knockout's `checked` binding would
overwrite one even if you added it. So when the terminal requires the agreement the
box ends up unchecked, invisible, and impossible to tick.

**The header title is injected by CSS.** The text you asked to remove,
`בית מלאכה לצילום`, is not in the HTML anywhere. It's
`printhouse-design.css` line 124, `.header .headerIn::before`. That's the only
place to change it.

## The iframe variant is not the same template

`iframe-stock.html` is what Cardcom serves to the React shell, and it differs from
the standard page in ways the CSS notices:

**There is no header.** The standard template has two `.header` elements; the iframe
template has zero. So the branded lockup the design injects with
`.header .headerIn::before` / `::after` renders nothing here. `test.css` spends 32
rules on `.header` and the design layer another 11, all dead in the iframe. If you
want branding inside the React app, it has to hang off an element that exists.

**The footer nests differently.** The iframe wraps everything in `.footerIfIframe`,
and the fallback footer is a *sibling* of `.footer`, not a child:

```
<div class="footerIfIframe">
    <div class="footer">              <- shown when !HideFooter()
        <div class="footerIn">
    <div class="footerIn centered">   <- shown when HideFooter(), NOT inside .footer
```

`test.css` styles that second one as `.footer .footerIn.centered`, which cannot match
here. When `HideFooter()` is true the iframe gets an unstyled footer. No stylesheet in
this repo mentions `.footerIfIframe` at all.

**Both card-number inputs share `id="txtCardNumber"`.** The standard template gives
the mobile one `id="txtCardNumber-number"`; the iframe template does not, so the id is
duplicated and `<label for="txtCardNumber">` resolves to the first only. That's
Cardcom's markup, not ours. `apply-edits.py` places a placeholder on both regardless,
because it matches `data-testid` too.

**`data-testid` values are renamed.** `txtCustNameInput` on the standard page is
`txt-cust-name-input` here. Anything keyed to those strings needs to accept both.

## `.page` does not exist on either template

`checkout.css` builds the pinned header/footer/pay-button layout on `.page`:

```
.page { display: flex !important; flex-direction: column !important; }
.page { height: 100% !important; overflow: hidden !important; }
```

Neither Cardcom template contains a `.page` element — it exists only in the local
preview file `checkout.html`. So the entire pinned layout is inert on the live page,
which is why the pay button scrolls with the content instead of staying put. To make
it work it has to be re-keyed to a wrapper Cardcom actually renders.

## Ground rules when you edit

Cardcom's page is driven by Knockout, and the bindings are load-bearing:

- Never touch a `data-bind` attribute, and never remove an `id` the bindings use.
  Add wrapper elements and classes around things instead.
- Hide with `display: none`. Do not delete elements from the HTML.
- Don't use `!important` to hide anything Knockout controls with `visible:`. You'll
  win the specificity fight and break the behavior — that's exactly how the error
  messages ended up dead.
- The footer must read `הסליקה מתבצעת דרך קארדקום`. Cardcom requires the wording.
- Leave the phone and email fields reachable. 3D Secure validates against one of
  them, and hiding both fails transactions.
