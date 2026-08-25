# Questions for GPT (Cardcom API docs)

Context — please read before answering:

We maintain a **custom design for Cardcom Low Profile** (hosted checkout): static HTML + CSS pasted into Cardcom's custom-design editor (עיצוב מותאם אישית). Sessions are created with **POST /api/v11/LowProfile/Create** (TerminalNumber, ApiName, Amount, Language, Operation, SuccessRedirectUrl, FailedRedirectUrl, optional UIDefinition). The same hosted page is used two ways: opened as a **full redirect page** (wide desktop) and embedded in a merchant **iframe** (600–1280px wide). We are redesigning only the iframe (compact) layout, CSS-only. We cannot run JavaScript inside the page — Knockout and wallet SDKs are Cardcom's.

We already know (do not re-explain): the HTML pane rejects `embed/object/frameset/frame/iframe/meta/link/style` tags; paste order is HTML then CSS (HTML resets the CSS pane); old payment URLs keep their old stylesheet; `UIDefinition.CSSUrl` exists and overrides the terminal design; `UIDefinition.GooglePayBtnDesign` exists; 3DS fails if both cardholder phone and email are hidden; the parent iframe needs `allow="payment"` + `allowpaymentrequest`; Apple Pay in an iframe needs the embedding domain registered with Cardcom.

**Answer by question number. If the documentation does not cover something, answer "not documented" — do not guess.** Where an answer differs between API versions or terminal configurations, say which.

## A. Stored designs and iframe vs redirect

1. Does Cardcom store **one** custom HTML+CSS design that serves both the redirect page and the iframe embed, or **separate stored designs per mode**? The design editor shows a template dropdown that includes an "iframe" template variant — is that a separately **stored** design slot, or just a different starting template to paste over?
2. When a Low Profile URL is opened (a) top-level after redirect and (b) inside a merchant iframe — what decides which stored design/template the server returns? Anything in the Create request or the URL?
3. Confirm the design-slot model per language: are there exactly two stored custom designs keyed by editor direction (RTL slot = Hebrew + Arabic, LTR slot = English + Russian + other LTR packs)? Which language packs map to which slot? Does Create `Language` ever select a different stored design, or only different labels?
4. Does the served checkout document carry **any marker CSS can target** that distinguishes iframe embedding from top-level (a class or attribute on `html`/`body`/`#Content`, a query parameter reflected into the DOM, anything)? We currently infer "iframe" purely from viewport width 600–1280px, which also catches a resized desktop window.

## B. Page environment and editor limits

5. What wrapper does Cardcom render the pasted HTML into (`#Content`? `.page`? anything else), and does Cardcom apply CSS `zoom` (e.g. 0.5) to it in any mode or viewport? May pasted CSS override that zoom?
6. Is the pasted CSS **layered on top of** Cardcom's stock stylesheet (stock loads first, ours later), or does it **replace** stock entirely? Is the load order guaranteed?
7. Editor pane limits: maximum size (characters/KB) of the HTML pane and the CSS pane; does the CSS pane sanitize or strip anything (specific at-rules, `url()` schemes, `data:` URIs, comments, modern selectors like `:has()`)? Are emoji / non-ASCII characters in the HTML pane safe?
8. Which browsers/versions does Cardcom officially support for Low Profile? (We rely on `:has()`, `clamp()`, `dvh`, `color-mix()` — already in production CSS, but we want the documented support floor.)
9. For iframe embedding: does Cardcom document supported/recommended iframe dimensions (min/max width and height)? Does the page communicate with the parent (postMessage resize/success events), or is it fully passive? Any parent-iframe requirements besides `allow="payment"`/`allowpaymentrequest`?

## C. Wallets

10. Apple Pay lifecycle: when the terminal has Apple Pay enabled but the customer's browser does not support it, does `IsApplePayActive` become false (so the `.ApplePayDiv` content is removed by Knockout), or can `.ApplePayDiv` remain in the DOM with all three buttons (`_SetupBtn`/`_PaymentBtn`/`_PopupBtn`) hidden for the entire session? Is it safe for CSS to hide the outer `.ApplePayDiv` container while it contains no visible button, or does the Apple Pay SDK need the container measurable (not `display:none`) during initialization?
11. Google Pay: how late after page load can Google's button inject into `#GooglePayDiv`? When Google Pay is unavailable for the session, is `hide: hideGooglePay` guaranteed to hide the div, or can `#GooglePayDiv` remain visible-and-empty? Also: the documented values of `GooglePayBtnDesign.ButtonColor` / `ButtonType` enums, and accepted units/ranges for `ButtonWidth` / `ButtonHeight`.
12. Bit: can more than one Bit integration (`#uPayBitDiv` / `#PayMeBitDiv` / `#CardcomBitDiv`) be active on one terminal at the same time? After the customer clicks Bit, do the countdown + status text + QR image (`#qrBarcode`, ~200px) render **inline in the same layout** (pushing content down), or does the page switch to a different view? How much space should a fixed-height layout reserve?
13. PayPal: does Cardcom inject the PayPal SDK (`.paypal-buttons`, an iframe) into `.paypalDiv`, or only bind a static image (`images.paypal`) with a click handler? Is that terminal-dependent?
14. MasterPass: is it still an active option on current terminals, or legacy that will never render?
15. What is the maximum number of wallet/express methods that can be simultaneously visible on one terminal (Google Pay + PayPal + Apple Pay + Bit + MasterPass = 5)?

## D. Fields, flows, runtime furniture

16. Besides 3DS forcing cardholder phone/email: the full list of conditions that force fields visible at runtime regardless of terminal config. When both phone and email are configured hidden and 3DS runs, which one does Cardcom force?
17. Can `openSum` (open amount) and `numberOfPayments` (installments) be shown together? When installments are shown, is the inline total (`hide: hideNumberOfPayments`) always shown with it?
18. Custom fields (`customFields`): maximum count, and where do they render when `order.showInvoiceHead` is false (billing section hidden)? Do they always live inside the billing/invoice section?
19. Order summary extras: can `showCommissionSummery`, `showOriginalSum`, and `showCoinConvert` all be active at once? What produces per-line remark rows in the products table (invoice line remarks), and what is their DOM?
20. reCAPTCHA (`IsRecaptchaActive`): which reCAPTCHA version/widget renders in `#captcha_container`, at what fixed size, and can it resize after render?
21. `labels.HtmlComments`: is it arbitrary merchant HTML? Any size limit? Is it rendered in iframe mode too?
22. 3DS challenge presentation: inside the same document (overlay), a nested iframe within the checkout page, or a full navigation? Is there anything the pasted CSS must not do to the page (overflow/height/z-index constraints on specific containers) to keep the challenge working?
23. On payment success inside an iframe: does `SuccessRedirectUrl` navigate the iframe itself or the top window? Are the `#PopUpRTL`/`#PopUpLTR` (Magnific Popup) success popups shown inside the iframe, and do they require the page to be scrollable?
24. Validation and errors: the possible values Knockout writes via `CssValid` (we observe `errorRow` and `success` — is that the complete set)? How many `error.messages` can stack in `.errorDiv` at once, and does Cardcom auto-scroll to it?
25. `IsMobile`: decided by user-agent or viewport width? In a 600–1280px iframe on a desktop browser, is the `type=text` card-number input always the visible one?
26. What is the runtime-injected `#privacy-policy-container` exactly (tag structure and position relative to `.submitDiv`), and what is the `.footerIframe` element Cardcom's stock CSS sizes on small screens (neither exists in the pasted HTML)?

## E. Create API / UIDefinition

27. The **complete documented schema of `UIDefinition`** in /api/v11/LowProfile/Create — every field beyond `CSSUrl` and `GooglePayBtnDesign` (field-hiding flags like card owner name/phone/email, invoice-info hiding, logo, theme, anything).
28. Which Create-request options control `IsHideInvoiceInfo` (hides the products/summary block) and `order.showInvoiceHead` (hides the billing-details section)? Dashboard setting, Create field, or both?
29. Language settings (הגדרות לפי שפה): is `lph1` (header title) merchant-configurable per language with Cardcom defaults per pack? Which packs ship `PayByCreditCard` untranslated (we know Arabic/Russian/Portuguese show English)? Does Cardcom stamp `dir`/`lang` on `html` or `body` per session language?
