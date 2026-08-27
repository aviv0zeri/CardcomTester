# Compact Iframe Layout — Ready to Verify & Promote

**Status:** Bug-fixed CSS in `_wip/` copies, adversarial review completed, 6 real bugs found and patched.

## What was done

Redesigned the Low Profile **iframe-only layout** (600–1280px viewport) to pack checkout efficiently across three frame shapes from a single HTML+CSS paste:

- **Landscape** (1180×800): two-column layout, wallets + card side-by-side, billing full width above.
- **Squarish** (900×720): same two-column layout, all sections compressed with clamp() toward readable minimums.
- **Portrait** (640×900): single-column stack (billing, wallets, card, submit), max-width capped to fit without horizontal scroll.

No JavaScript. No HTML changes. No new tags. CSS-only, respecting all Cardcom paste constraints:
- Never `display:none` on `#GooglePayDiv` (Cardcom injects Google Pay).
- Hide Apple Pay/Bit containers only via `:not(:has(*))` when truly empty (SDK init stays safe).
- Preserve all Knockout `data-bind`, IDs, Cardcom wallet bindings, custom field structure.
- Flex-wrapped wallets (no pinned grid cells) so hidden methods and Cardcom-removed fields drop out without holes.
- Bit QR inline-expansion safe: payment column scrolls only when QR present, escape hatch via `:has(#qrBarcode[src])`.
- UIDefinition-hidden fields (owner name, phone, email, ID, CVV) auto-drop from the 2-column card-form grid via `display:contents` on wrappers.

## Files & testing

Working copies in `templates/cardcom/low-profile/_wip/`:
- `checkout.html` — canonical (no changes)
- `rtl/checkout.css` — all compact rules RTL-scoped (html.checkout-embed + @media 600-1280px)
- `ltr/checkout.css` — direction-flipped LTR variant (select arrows, padding-left/right, direction: ltr on payment split)

**Preview URL** (localhost on port 8081):
```
http://127.0.0.1:8081/cardcom-preview/open.html?v=low-profile/he/embed&wip=1&wallets=4&billing=0
```
Add `&wallets=1|2|3` to test reflow, `&billing=0` for invoice-hidden layout, or swap `he` for `en`/`ar`/`ru`.

**Adversarial review:** 5 reviewers + 6 verifiers ran independently, found 6 real bugs (1 blocker, 5 should-fix), all fixed in the source:

1. ✅ **Billing card padding blocker** — Base rule's `padding:20px 22px` (0,2,0) beats unprefixed compact media rule (0,1,0). Fixed: added `!important` padding to the `.checkout-card.checkout-order` compact rule.
2. ✅ **Header column-stack leak at 600px** — Base `@media (max-width:600px)` and compact `@media (min-width:600px)` both match at exactly 600px, leaking flex-direction:column. Fixed: re-asserted `flex-direction:row; align-items:center; justify-content:space-between` in compact header rule.
3. ✅ **Bit button height clamping loses specificity** — Base uses double-ID selector (`#uPayBitDiv #bit-payment-button`, 2,0,0), compact used bare `#bit-payment-button` (1,0,0), base wins. Fixed: changed compact to double-ID selectors to match.
4. ✅ **Bit container min-height forgot the Bit outer IDs** — Compact slot min-height list included Apple/PayPal but dropped the three Bit outer div IDs, so Bit rows don't compress. Fixed: added `#uPayBitDiv`, `#PayMeBitDiv`, `#CardcomBitDiv` to the min-height lists.
5. ✅ **Bit QR scroll escape trap** — Payload overflows with centered content, making top unreachable. Fixed: added `justify-content:flex-start` to the `:has(#qrBarcode[src])` escape rule.
6. ✅ **Select arrow clearance clobbered** — Compact padding shorthand wiped the base's 32px arrow-side clearance on all selects (except the expiry pair which had separate rules). Fixed: added `.fieldInput select:not(.mini):not(.tiny)` with `padding-right:24px; padding-left:8px !important`.

## Next steps

1. **Verify in live Cardcom** — The _wip copies are locked to localhost. Before promoting:
   - Test wallets visible/hidden (terminal UIDefinition).
   - Test fields hidden via UIDefinition (name, phone, email, CVV).
   - Test 3DS (forced phone/email) to ensure 24px padding doesn't clip submit.
   - Test on an actual iframe with `allow="payment"` + `allowpaymentrequest`.
   - Test a top-level Cardcom redirect resized to ~900px wide and confirm that receiving the compact layout is acceptable. If not, the current CSS cannot reliably distinguish iframe from redirect without some external signal Cardcom does not document.

2. **Promote to canonical** — Once verified, copy `_wip/rtl/checkout.css` → `rtl/checkout.css` and `_wip/ltr/checkout.css` → `ltr/checkout.css` (base sections are byte-identical by construction).

3. **Export & paste into Cardcom**:
   ```bash
   cardcom_export he  # copies rtl variant to clipboard
   cardcom_export en  # copies ltr variant to clipboard
   ```
   Paste each into the respective editor slot (RTL = Hebrew/Arabic, LTR = English/Russian/etc.).

4. **Verify wide redirect untouched** — The compact section's `html.checkout-embed` prefix + `@media (min-width:600px) and (max-width:1280px)` scoping guarantee the wide redirect (>1280px, no embed class) never sees the new rules. Run a visual regression on the 1400px wide page to confirm it matches the original.

## Constraints & guarantees

- ✅ No JavaScript in the HTML pane.
- ✅ Base sections (first ~1200 lines) byte-identical to canonical (confirmed by diff during build).
- ⚠️ Live compact rules are viewport-scoped to 600–1280px. Cardcom does not expose a documented iframe-only CSS marker, so a top-level redirect opened at that width will also receive the compact layout. Wide redirects above 1280px remain unaffected.
- ✅ Wide redirect (>1280px) never touched by any compact rule.
- ✅ Google Pay `#GooglePayDiv` never hidden via CSS (Cardcom SDKs it).
- ✅ Apple Pay/Bit outer containers only hidden when truly empty (`:not(:has(*))`).
- ✅ RTL ↔ LTR differences isolated: select-arrow background-position and padding directions, direction: rtl/ltr on one rule.
- ✅ Bit QR expansion safe (payment column scrolls only when QR present).
- ✅ UIDefinition field-hiding safe (grid with `display:contents` on wrappers).

## Files to hand off to Cursor

- `templates/cardcom/low-profile/_wip/rtl/checkout.css` — ready to test & promote
- `templates/cardcom/low-profile/_wip/ltr/checkout.css` — ready to test & promote
- This document: `COMPACT-IFRAME-HANDOFF.md`

No scratchpad files or intermediate artifacts needed. The Cursor workflow continues from here.
