# Aviv brand skin — working copy (do not paste)

Compact Low Profile: logo, business name, wallets, card fields, SSL notice, terms line.

What Cardcom asked for on the page:

- Required: business logo, business name, cardholder name, CVV
- Optional: ID (`תעודת זהות`)
- Also kept: card number + expiry (needed to charge)
- Wallets in a 2-column grid (Google Pay slot stays even when empty)

Invoice / billing fields stay off this skin. Send customer + document data in Low Profile Create (`Document` / invoice head) so Cardcom issues the invoice from your site. No second “all forms” page unless Create cannot hide `ShowInvoiceHead`.

Terms links are placeholders (`href="#"`). Point them at Aviv order-terms and cancellation pages — do not copy Canaan Tourism.

`cardcom export` copies this folder (HTML, then RTL or LTR CSS plus `brand-skin.css`). Logo `src` is localhost; live Cardcom needs HTTPS.

Preview:

```
/cardcom-preview/open.html?v=low-profile/he&brand=1&wallets=4
```
