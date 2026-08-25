# Cardcom Low Profile templates

Paste-ready **static HTML + CSS**. Cardcom stores **two** custom designs, by direction:

- RTL — Hebrew and Arabic share one HTML/CSS slot
- LTR — English and Russian share one HTML/CSS slot

Create `Language` only switches Knockout labels (`labels.*`, `lph1`, field labels). It does not pick a fourth HTML file.

```
low-profile/
├── checkout.html          ← paste into BOTH direction slots
├── rtl/checkout.css       ← paste into RTL (עברית וערבית)
├── ltr/checkout.css       ← paste into LTR (אנגלית ושפות נוספות)
└── _archive/
```

Do not hardcode customer-visible sentences in HTML. Header title is `lph1`. Card divider is `labels.PayByCreditCard` (Hebrew/English). Cardcom leaves that key in English for Arabic, Russian, Portuguese, and most other packs — RTL/LTR CSS fills those with `:lang()` / `ApplePay.language` on `.card-payment-title`.

Same files for redirect and iframe. `html.checkout-embed` is localhost-only.

Do not add JavaScript. Keep Cardcom IDs, `data-bind`, wallet stubs, and 3DS hooks. Export with `cardcom_export`.

Open Fields and native Direct are later, separate integrations.
