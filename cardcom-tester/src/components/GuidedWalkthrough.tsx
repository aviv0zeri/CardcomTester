import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Language } from './CheckoutControls'
import { PaymentOverlay } from './PaymentOverlay'
import { GuidedCart } from './GuidedCart'
import { DEFAULT_CART, apiLineItems, cartTotal, resolveItems, type CartItem } from './cart'
import type { UiLang } from './uiLang'
import { useViewport } from './useViewport'
import {
  asRecord,
  asText,
  checkLabResult,
  createLabSession,
  newProduct,
  responseCode,
  type CardcomPayload,
} from './labClient'
import {
  OPEN_FIELDS_REGIONS,
  openFieldsUrl,
  PAGE_THEMES,
  type OpenFieldsRegion,
  type PageTheme,
} from './previewVersions'
import {
  createCustomer,
  createEmbeddedFieldsCheckoutSession,
  createHostedCheckoutSession,
  getPayment,
  resolveSpectraCustomer,
  verifyCheckoutSession,
  type SpectraCheckoutSession,
  type SpectraCustomer,
  type SpectraPayment,
  type SpectraVerifyResult,
} from './spectraClient'
import { MenuSelect } from './MenuSelect'
import { playClick, playError, playStep, playSuccess } from './sfx'
import { PROFILES, profileById, type BusinessProfile } from './profiles'

// One screen at a time, one action at a time. The whole point of this tab is
// that nothing scrolls and nothing competes for attention -- the full ApiLab
// stays next door for power use. The walkthrough speaks Hebrew or English
// (one toggle drives both the interface and the payment page), and each big
// step carries an optional "under the hood" corner that teaches the tech
// (HTTP, API, JSON, webhooks) using the REAL payloads from this very run.

type GuidedStep = 'intro' | 'profile' | 'pick' | 'device' | 'setup' | 'create' | 'pay' | 'check' | 'done'

// Where the customer pays. Drives the pay step's frame: size, a phone/tablet
// bezel, and (in-app) the payment page's embedded layout.
type DeviceChoice = 'phone-app' | 'phone-web' | 'tablet' | 'desktop'
const DEVICE_CHOICES: DeviceChoice[] = ['phone-app', 'phone-web', 'tablet', 'desktop']

// Quick accent picks (the business's own blue first); the native colour input
// stays for anything else. Presets also sidestep Safari's colour input, which
// only reports a pick once the macOS colour panel is closed.
const ACCENT_PRESETS = ['#3d5580', '#0e7c66', '#c2410c', '#b91c1c', '#6d28d9', '#111827']

// Desktop two-panel layouts: both columns at once, or summary first with a
// Continue that slides the payment column in.
type DualMode = 'side-by-side' | 'continue'
const DUAL_MODES: DualMode[] = ['side-by-side', 'continue']
type Integration = 'lowprofile' | 'openfields' | 'spectra'
type Lang = UiLang

const TEST_CARD_NUMBER = '4580 2800 0000 0008'
const TEST_CARD_RAW = '4580280000000008'

type Copy = {
  dots: [string, string, string, string, string, string, string]
  introBubble: ReactNode
  introGo: string
  pickBubble: ReactNode
  // Device step: where the customer pays (phone in-app / phone browser / tablet / desktop).
  deviceBubble: ReactNode
  deviceTitles: Record<DeviceChoice, string>
  deviceShorts: Record<DeviceChoice, ReactNode>
  deviceLong: Record<DeviceChoice, ReactNode>
  // Pay step, desktop: your-own-app order summary shown beside the payment frame.
  sideBySideLabel: string
  sideBySideContinue: string
  layoutLabel: string
  layoutLabels: Record<DualMode, string>
  // Business step: which business (Cardcom terminal + Spectra project + brand).
  profileBubble: ReactNode
  profileLabel: string
  profileLong: (name: string) => ReactNode
  // Payment-page look (Open Fields only): theme switch + accent colour.
  lookLabel: string
  themeLabels: Record<PageTheme, string>
  accentLabel: string
  walletsLabel: string
  lpTitle: string
  lpShort: ReactNode
  ofTitle: string
  ofShort: ReactNode
  lpLong: ReactNode
  ofLong: ReactNode
  continueBtn: string
  backBtn: string
  setupBubble: ReactNode
  templateLabel: string
  regionLabels: Record<OpenFieldsRegion, string>
  receiptToggle: string
  receiptEmailLabel: string
  createBubble: (amount: number) => ReactNode
  createOk: (ticket: ReactNode) => ReactNode
  createBtn: string
  creating: string
  tryAgain: string
  techTitleCreate: string
  techCreateIntro: ReactNode
  techCreateSent: ReactNode
  techCreateGot: ReactNode
  payBubbleLp: ReactNode
  payBubbleOf: ReactNode
  cardTitle: string
  cardExp: string
  cardId: string
  copyBtn: string
  copied: string
  copyFailed: string
  openPayBtn: string
  openAgain: string
  paidContinue: string
  popupBlocked: string
  popupOpenHere: string
  techTitlePay: string
  techPayLp: ReactNode
  techPayOf: ReactNode
  restartBtn: string
  openNewTab: string
  checkBubble: (ticket: string) => ReactNode
  askBtn: string
  asking: string
  askAgain: string
  pending5119: string
  techTitleCheck: string
  techCheckIntro: ReactNode
  techTicketVsAttempt: ReactNode
  doneConfirmed: (details: ReactNode) => ReactNode
  donePaidAmount: (amount: string) => string
  doneCardEnding: (last4: string) => string
  doneTransaction: (id: string) => string
  doneRecap: (integration: Integration) => ReactNode
  doneReceipt: (email: string) => ReactNode
  runAgain: string
  err605: string
  errGeneric: (code: string, description: string) => string
  errServer: (message: string) => string
  // Spectra Payments path -- our own Payment API in front of Cardcom.
  spTitle: string
  spShort: ReactNode
  spLong: ReactNode
  createBubbleSp: (amount: number) => ReactNode
  createOkSp: (ticket: ReactNode) => ReactNode
  techTitleCreateSp: string
  techCreateIntroSp: ReactNode
  techCreateSentSp: ReactNode
  techCreateGotSp: ReactNode
  checkBubbleSp: ReactNode
  pendingSp: string
  techTitleCheckSp: string
  techCheckIntroSp: ReactNode
  techCheckContrastSp: ReactNode
  doneRecapSp: ReactNode
  doneStatusSp: (status: string) => string
  errSpectra: (message: string) => string
  presentationLabel: string
  presentationHosted: string
  presentationEmbedded: string
}

const COPY: Record<Lang, Copy> = {
  en: {
    dots: ['Business', 'Choose', 'Device', 'Cart', 'Session', 'Pay', 'Verify'],
    deviceBubble: (
      <>
        <strong>Where will your customer pay?</strong> Pick the screen to imitate. The payment page
        opens in a frame of that size, and for the in-app case it is embedded the way a mobile app
        would embed it.
      </>
    ),
    sideBySideLabel: "Your app's screen",
    sideBySideContinue: 'Continue to payment →',
    layoutLabel: 'Desktop layout',
    layoutLabels: { 'side-by-side': 'Side by side', continue: 'Summary, then payment' },
    deviceTitles: {
      'phone-app': 'Phone · in your app',
      'phone-web': 'Phone · in the browser',
      tablet: 'Tablet',
      desktop: 'Desktop',
    },
    deviceShorts: {
      'phone-app': 'The payment form embedded inside the app itself (a WebView).',
      'phone-web': 'The customer taps a link and pays on a full page in the phone browser.',
      tablet: 'Bigger screen, still touch — 768×1024 portrait.',
      desktop: 'A computer browser — the widest layout.',
    },
    deviceLong: {
      'phone-app': (
        <>
          <strong>Embedded.</strong> The page is trimmed to fit a phone-sized frame inside the app —
          no browser bar, no cart screen, straight to the fields.
        </>
      ),
      'phone-web': (
        <>
          <strong>A full page on a 390×844 phone.</strong> The page's own layout, scrolled like any
          mobile site.
        </>
      ),
      tablet: (
        <>
          <strong>Tablet-sized page.</strong> Check that the form does not stretch awkwardly at this
          width.
        </>
      ),
      desktop: (
        <>
          <strong>Wide stage.</strong> The whole page fits without scrolling.
        </>
      ),
    },
    introBubble: (
      <>
        <strong>Hi! Let's run a pretend payment.</strong> Real Cardcom API, real screens,
        fake money — nothing here can charge a real person. We'll go one small step at a
        time, and I'll explain what each step means as we go.
      </>
    ),
    introGo: "Let's go",
    pickBubble: (
      <>
        There are three ways to take a payment here. <strong>Pick one</strong> — you can
        always come back and try another.
      </>
    ),
    profileBubble: (
      <>
        First, <strong>whose business is this?</strong> Every business has its own Cardcom
        terminal and its own data on our side. Pick the one to act as.
      </>
    ),
    profileLabel: 'Business',
    lookLabel: 'Payment page look',
    themeLabels: { system: 'System', light: 'Light', dark: 'Dark' },
    accentLabel: 'Accent',
    walletsLabel: 'Wallets',
    profileLong: (name) => (
      <>
        From here on everything runs as <strong>{name}</strong>: sessions go to its Cardcom
        terminal, its logo is on the payment page, and every Customer and Payment is stored
        under its own project.
      </>
    ),
    lpTitle: 'Low Profile',
    lpShort: (
      <>
        Cardcom hosts the whole payment page. You just send your customer there. The easy
        way — GateOpen uses this one.
      </>
    ),
    ofTitle: 'Open Fields',
    ofShort: (
      <>
        The page is yours. Only the card number and CVV boxes (highlighted) belong to
        Cardcom. More control, more work.
      </>
    ),
    lpLong: (
      <>
        <strong>Low Profile is the "send them to Cardcom" way.</strong> Your app asks
        Cardcom for a session and gets back a link. You send your customer to that link —
        Cardcom's own page takes the card and handles all the scary security rules. Your
        only two jobs: create the session, then verify the answer. This is exactly how
        GateOpen charges.
      </>
    ),
    ofLong: (
      <>
        <strong>Open Fields is the "build it yourself" way.</strong> The checkout page is
        yours — your design, your fields. Only the two sensitive boxes (card number and
        CVV) are little Cardcom windows dropped into your page, so card details never touch
        your code. Full control over the look, but your page and Cardcom's boxes have to
        talk to each other with messages — more work.
      </>
    ),
    continueBtn: 'Continue',
    backBtn: 'Back',
    setupBubble: (
      <>
        <strong>Let's fill a pretend cart.</strong> Pick a ready-made one or stack things one by
        one — the cart's total is what we'll charge. In Cardcom's test world any total under
        ₪5000 succeeds; want to practice a <em>failed</em> payment someday? Make it 5000 or more.
      </>
    ),
    templateLabel: 'Form template',
    regionLabels: { il: 'Israel', us: 'US', eu: 'Europe' },
    receiptToggle: 'Email me the receipt',
    receiptEmailLabel: 'Email for the receipt',
    createBubble: (amount) => (
      <>
        First, our server tells Cardcom: <em>"someone is about to pay ₪{amount}"</em>.
        Cardcom writes it down and hands back a <strong>ticket</strong> (a "LowProfileId").
        No money moves yet — it's just a reservation, like taking a number at the bakery.
      </>
    ),
    createOk: (ticket) => <>Cardcom said yes! Our ticket: {ticket}</>,
    createBtn: 'Create the session',
    creating: 'Asking Cardcom…',
    tryAgain: 'Try again',
    techTitleCreate: '🤓 Under the hood — what are API, HTTP and JSON?',
    techCreateIntro: (
      <>
        When you pressed the button, code (JavaScript) in this page sent an{' '}
        <strong>HTTP request</strong> — a letter delivered over the internet — to our own
        server. Our server added the secret password and forwarded it to Cardcom's{' '}
        <strong>API</strong>. An API is like a restaurant counter: your code places an
        order, Cardcom's kitchen cooks, and an answer comes back.
      </>
    ),
    techCreateSent: (
      <>
        The letter's content is written in <strong>JSON</strong> — a simple text format
        both computers understand. This is what we really sent:
      </>
    ),
    techCreateGot: <>And this is the real answer Cardcom just returned:</>,
    payBubbleLp: (
      <>
        <strong>Cardcom's real payment page</strong> opens right here, inside a frame. Pay
        with this pretend card (it only exists in the test world), close the frame, and
        press continue.
      </>
    ),
    payBubbleOf: (
      <>
        <strong>Our own page</strong> opens right here, inside a frame — the card number
        and CVV boxes in it are Cardcom's secure iframes, everything else is ours. Pay with
        the pretend card, close the frame, and press continue.
      </>
    ),
    cardTitle: 'TEST CARD',
    cardExp: 'EXP',
    cardId: 'ID',
    copyBtn: 'Copy number',
    copied: 'Copied!',
    copyFailed: 'Copy is blocked here — select the number above and copy it by hand (⌘/Ctrl+C).',
    openPayBtn: 'Open the payment page',
    openAgain: 'Open it again',
    paidContinue: 'I paid — continue',
    popupBlocked: 'Popup blocked — ',
    popupOpenHere: 'open the payment page here',
    techTitlePay: '🤓 Under the hood — URLs, redirects and webhooks',
    techPayLp: (
      <>
        Look at the payment page's address (URL) — our ticket is embedded inside it. When
        the payment finishes, two things happen: the browser gets{' '}
        <strong>redirected</strong> to a success address we chose, and in parallel Cardcom
        sends a <strong>webhook</strong> — an HTTP request in the opposite direction,
        Cardcom's server calling ours — with the result. That's how your system learns
        about payments even if the customer closes the tab.
      </>
    ),
    techPayOf: (
      <>
        An <strong>iframe</strong> is a small window that shows another website's page
        inside yours. Our page and Cardcom's windows talk through postMessage — little
        notes passed between browser windows. That's why the card number is typed directly
        into Cardcom and never passes through our code — and why we're even allowed to
        build a page like this without special security certifications (PCI).
      </>
    ),
    restartBtn: '↺ Restart',
    openNewTab: 'Open in a new tab instead',
    checkBubble: (ticket) => (
      <>
        The payment page said "success" — but <strong>we never trust the pretty screen</strong>.
        Screens can lie; users close tabs. So we ask Cardcom directly, server to server:
        <em> "did ticket {ticket}… really get paid?"</em> That answer is the only one your
        app should believe. One more thing worth knowing: the same ticket can be tried
        more than once — if a first try gets rejected, trying again on the very same
        ticket is normal. What matters is whether <em>any</em> try succeeded.
      </>
    ),
    askBtn: 'Ask Cardcom',
    asking: 'Asking Cardcom…',
    askAgain: 'Ask again',
    pending5119:
      'Cardcom says: no payment on this ticket yet. Finish the payment page in the other tab, then ask again.',
    techTitleCheck: '🤓 Under the hood — the real answer',
    techCheckIntro: (
      <>
        We sent one more HTTP request, this time to an endpoint called{' '}
        <strong>GetLpResult</strong>. The answer came back as JSON. The field that matters
        is <strong>ResponseCode</strong>: zero means "really paid". Anything else — don't
        trust it. Here is the answer exactly as it arrived:
      </>
    ),
    techTicketVsAttempt: (
      <>
        Two different IDs matter here, and they're not the same thing.{' '}
        <strong>LowProfileId</strong> (the ticket) is the whole payment session — it can
        stay open across more than one try. <strong>TranzactionId</strong> is just one
        attempt within that session. We've actually seen this ourselves: a session's first
        attempt got rejected by the card networks, and a second attempt on that exact same
        ticket then succeeded — each attempt got its own TranzactionId, its own
        ResponseCode, and its own webhook notification, all tied to the one LowProfileId.
        A failed attempt doesn't mean the session is dead.
      </>
    ),
    doneConfirmed: (details) => (
      <>
        <strong>Cardcom confirmed it!</strong> {details}
      </>
    ),
    donePaidAmount: (amount) => `₪${amount} paid`,
    doneCardEnding: (last4) => ` with card ending ${last4}`,
    doneTransaction: (id) => ` — transaction #${id}`,
    doneRecap: (integration) => (
      <>
        <strong>What just happened, in one breath:</strong> we reserved a payment with
        Cardcom (the ticket), the customer paid on{' '}
        {integration === 'openfields'
          ? "our page with Cardcom's secure card boxes"
          : "Cardcom's hosted page"}
        , and then we verified it server-to-server instead of trusting the screen. That's
        the whole flow — everything else is details on top.
      </>
    ),
    doneReceipt: (email) => (
      <>
        Cardcom also generated a receipt and emailed it to <strong>{email}</strong> — check
        the inbox (it can take a minute).
      </>
    ),
    runAgain: 'Run it again',
    err605:
      'Cardcom answered: the test account is locked right now (they lock it outside working hours, Sun–Thu until 17:00). This is a real answer from Cardcom, not a bug in the tester. Try again later.',
    errGeneric: (code, description) =>
      `Cardcom answered with an error (code ${code}): ${description || 'no description'}. That answer itself is useful — it is exactly what your app would need to handle.`,
    errServer: (message) => `Could not reach the tester's own server: ${message}`,
    spTitle: 'Spectra Payments',
    spShort: (
      <>
        Our own Payment API sits in front of Cardcom. Same hosted page — but your app only
        ever sees Customers and Payments, never raw Cardcom.
      </>
    ),
    spLong: (
      <>
        <strong>Spectra Payments is the "put our own API in front" way.</strong> Your app
        talks to <em>our</em> Payment API, not raw Cardcom — it gets the session, keeps the
        secrets inside, and hands back clean objects: a Customer, a CheckoutSession, a
        Payment.
      </>
    ),
    createBubbleSp: (amount) => (
      <>
        First, our app tells <strong>our Payment API</strong>: <em>"this customer is about
        to pay ₪{amount}"</em>. Behind the scenes it takes the number at Cardcom's bakery
        for us — but what it hands back is a <strong>Payment</strong> and a{' '}
        <strong>CheckoutSession</strong> with our own IDs. No money moves yet.
      </>
    ),
    createOkSp: (ticket) => <>Our Payment API said yes! CheckoutSession: {ticket}</>,
    techTitleCreateSp: '🤓 Under the hood — one API in front of another',
    techCreateIntroSp: (
      <>
        Two HTTP requests went to <strong>our own Payment API</strong> (not to Cardcom):
        one to create a Customer, one to open a CheckoutSession. Our API then called
        Cardcom's LowProfile/Create itself, with the secret password that never leaves it.
      </>
    ),
    techCreateSentSp: <>This is what our app sent — notice: no password, no Cardcom fields:</>,
    techCreateGotSp: (
      <>
        And this is what came back. Look for what's <em>missing</em>: no LowProfileId, no
        ResponseCode. Cardcom's ticket stays inside our API; your app gets a{' '}
        <strong>payment_id</strong> and a <strong>checkout_url</strong> to send the customer to:
      </>
    ),
    checkBubbleSp: (
      <>
        The payment page said "success" — but <strong>we never trust the pretty screen</strong>.
        So our app asks <strong>our Payment API</strong> to verify. It asks Cardcom
        server-to-server (the same GetLpResult check as Low Profile), decides what the
        answer means, and records it as a Payment. The only thing your app believes is the
        Payment's <strong>status</strong>.
      </>
    ),
    pendingSp:
      'Our Payment API says: this Payment is still PENDING — no successful attempt recorded yet. Finish the payment page, then verify again.',
    techTitleCheckSp: '🤓 Under the hood — the normalized answer',
    techCheckIntroSp: (
      <>
        Our app sent one request to our Payment API's <strong>verify</strong> endpoint, then
        fetched the Payment. Here is what came back:
      </>
    ),
    techCheckContrastSp: (
      <>
        Compare this with the Low Profile path: there, <em>your</em> code had to read
        ResponseCode and TranzactionId and decide what they meant. Here the raw Cardcom
        answer never reaches your app — spectra-payments already checked it and turned it
        into one word, <strong>SUCCEEDED</strong>. The provider's IDs and codes live inside
        our API, so if the provider ever changes, your app doesn't.
      </>
    ),
    doneRecapSp: (
      <>
        <strong>What just happened, in one breath:</strong> our app asked our own Payment
        API to open a checkout (it got Cardcom's ticket for us), the customer paid on
        Cardcom's hosted page, and then we asked our API to verify — it checked with
        Cardcom server-to-server and recorded a Payment. Your app never touched a raw
        Cardcom field.
      </>
    ),
    doneStatusSp: (status) => ` — Payment ${status}`,
    errSpectra: (message) => `Could not reach spectra-payments: ${message}`,
    presentationLabel: 'Checkout presentation',
    presentationHosted: 'Hosted',
    presentationEmbedded: 'Embedded fields',
  },
  he: {
    dots: ['עסק', 'בחירה', 'מכשיר', 'עגלה', 'יצירה', 'תשלום', 'אימות'],
    deviceBubble: (
      <>
        <strong>איפה הלקוח ישלם?</strong> בחרו את המסך שנחקה. דף התשלום ייפתח במסגרת בגודל הזה,
        ובמקרה של אפליקציה הוא יוטמע כמו שאפליקציה מוטמעת אותו.
      </>
    ),
    sideBySideLabel: 'המסך של האפליקציה שלך',
    sideBySideContinue: 'המשך לתשלום ←',
    layoutLabel: 'פריסה במחשב',
    layoutLabels: { 'side-by-side': 'זה לצד זה', continue: 'סיכום ואז תשלום' },
    deviceTitles: {
      'phone-app': 'טלפון · בתוך האפליקציה',
      'phone-web': 'טלפון · בדפדפן',
      tablet: 'טאבלט',
      desktop: 'מחשב',
    },
    deviceShorts: {
      'phone-app': 'טופס התשלום מוטמע בתוך האפליקציה עצמה (WebView).',
      'phone-web': 'הלקוח לוחץ על קישור ומשלם בדף מלא בדפדפן של הטלפון.',
      tablet: 'מסך גדול יותר, עדיין מגע — 768×1024 לאורך.',
      desktop: 'דפדפן במחשב — הפריסה הרחבה ביותר.',
    },
    deviceLong: {
      'phone-app': (
        <>
          <strong>מוטמע.</strong> הדף מצומצם למסגרת בגודל טלפון בתוך האפליקציה — בלי שורת דפדפן
          ובלי מסך עגלה, ישר לשדות.
        </>
      ),
      'phone-web': (
        <>
          <strong>דף מלא בטלפון 390×844.</strong> הפריסה של הדף עצמו, נגלל כמו כל אתר מובייל.
        </>
      ),
      tablet: (
        <>
          <strong>דף בגודל טאבלט.</strong> בודקים שהטופס לא נמתח בצורה מוזרה ברוחב הזה.
        </>
      ),
      desktop: (
        <>
          <strong>במה רחבה.</strong> כל הדף נכנס בלי גלילה.
        </>
      ),
    },
    introBubble: (
      <>
        <strong>היי! בואו נריץ תשלום דמה.</strong> API אמיתי של קארדקום, מסכים אמיתיים,
        כסף מזויף — שום דבר כאן לא יכול לחייב בן אדם אמיתי. נתקדם צעד קטן אחד בכל פעם,
        ואני אסביר בדרך מה כל שלב אומר.
      </>
    ),
    introGo: 'בואו נתחיל',
    pickBubble: (
      <>
        יש כאן שלוש דרכים לקבל תשלום. <strong>בחרו אחת</strong> — תמיד אפשר לחזור
        ולנסות דרך אחרת.
      </>
    ),
    profileBubble: (
      <>
        קודם כל, <strong>של איזה עסק זה?</strong> לכל עסק יש מסוף קארדקום משלו ונתונים משלו
        אצלנו. בחרו בשם מי לפעול.
      </>
    ),
    profileLabel: 'עסק',
    lookLabel: 'מראה דף התשלום',
    themeLabels: { system: 'מערכת', light: 'בהיר', dark: 'כהה' },
    accentLabel: 'צבע מבטא',
    walletsLabel: 'ארנקים',
    profileLong: (name) => (
      <>
        מכאן והלאה הכול רץ בתור <strong>{name}</strong>: הסשנים הולכים למסוף שלו, הלוגו שלו
        מופיע בדף התשלום, וכל לקוח ותשלום נשמרים תחת הפרויקט שלו.
      </>
    ),
    lpTitle: 'Low Profile',
    lpShort: (
      <>
        קארדקום מארחים את כל דף התשלום. אתם רק שולחים את הלקוח לשם. הדרך הקלה — ככה
        GateOpen עובד.
      </>
    ),
    ofTitle: 'Open Fields',
    ofShort: (
      <>
        הדף שלכם. רק תיבות מספר הכרטיס וה-CVV (המודגשות) שייכות לקארדקום. יותר שליטה,
        יותר עבודה.
      </>
    ),
    lpLong: (
      <>
        <strong>Low Profile היא שיטת "שלח אותם לקארדקום".</strong> האפליקציה מבקשת
        מקארדקום סשן ומקבלת קישור. שולחים את הלקוח לקישור — הדף של קארדקום קולט את
        הכרטיס ומטפל בכל חוקי האבטחה המפחידים. שתי המשימות היחידות שלכם: ליצור את הסשן,
        ואז לאמת את התשובה. בדיוק ככה GateOpen מחייב.
      </>
    ),
    ofLong: (
      <>
        <strong>Open Fields היא שיטת "בנה בעצמך".</strong> דף התשלום שלכם — העיצוב שלכם,
        השדות שלכם. רק שתי התיבות הרגישות (מספר כרטיס ו-CVV) הן חלונות קטנים של קארדקום
        בתוך הדף, כך שפרטי הכרטיס אף פעם לא נוגעים בקוד שלכם. שליטה מלאה במראה, אבל הדף
        שלכם והתיבות של קארדקום צריכים לדבר בהודעות — יותר עבודה.
      </>
    ),
    continueBtn: 'המשך',
    backBtn: 'חזרה',
    setupBubble: (
      <>
        <strong>בואו נמלא עגלה לדוגמה.</strong> בחרו עגלה מוכנה או הוסיפו דבר-דבר — הסכום
        של העגלה הוא מה שנגבה. בעולם הבדיקות של קארדקום כל סכום מתחת ל-5000 ₪ מצליח;
        רוצים לתרגל מתישהו תשלום <em>שנכשל</em>? הגיעו ל-5000 ומעלה.
      </>
    ),
    templateLabel: 'תבנית טופס',
    regionLabels: { il: 'ישראל', us: 'ארה"ב', eu: 'אירופה' },
    receiptToggle: 'שלחו לי קבלה למייל',
    receiptEmailLabel: 'מייל לקבלה',
    createBubble: (amount) => (
      <>
        קודם כול, השרת שלנו אומר לקארדקום: <em>"מישהו עומד לשלם {amount} ₪"</em>. קארדקום
        רושמים את זה ומחזירים <strong>כרטיס תור</strong> ("LowProfileId"). עוד לא זז שקל —
        זו רק הזמנת מקום, כמו מספר בתור למאפייה.
      </>
    ),
    createOk: (ticket) => <>קארדקום אמרו כן! כרטיס התור שלנו: {ticket}</>,
    createBtn: 'צרו את הסשן',
    creating: 'שואל את קארדקום…',
    tryAgain: 'נסו שוב',
    techTitleCreate: '🤓 מתחת למכסה המנוע — מה זה API, HTTP ו-JSON?',
    techCreateIntro: (
      <>
        כשלחצתם על הכפתור, קוד (JavaScript) בדף הזה שלח <strong>בקשת HTTP</strong> — מכתב
        שנמסר דרך האינטרנט — לשרת שלנו. השרת הוסיף את הסיסמה הסודית והעביר את המכתב
        ל-<strong>API</strong> של קארדקום. API הוא כמו דלפק במסעדה: הקוד שלכם מזמין,
        המטבח של קארדקום מבשל, והתשובה חוזרת אליכם.
      </>
    ),
    techCreateSent: (
      <>
        תוכן המכתב כתוב ב-<strong>JSON</strong> — פורמט טקסט פשוט ששני מחשבים מבינים. זה
        מה שנשלח באמת:
      </>
    ),
    techCreateGot: <>וזו התשובה האמיתית שקארדקום החזירו הרגע:</>,
    payBubbleLp: (
      <>
        <strong>דף התשלום האמיתי של קארדקום</strong> נפתח ממש כאן, בתוך מסגרת. שלמו עם
        הכרטיס המזויף הזה (הוא קיים רק בעולם הבדיקות), סגרו את המסגרת ולחצו המשך.
      </>
    ),
    payBubbleOf: (
      <>
        <strong>דף משלנו</strong> נפתח ממש כאן, בתוך מסגרת — תיבות מספר הכרטיס וה-CVV
        בתוכו הן iframes מאובטחים של קארדקום, וכל השאר שלנו. שלמו עם הכרטיס המזויף, סגרו
        את המסגרת ולחצו המשך.
      </>
    ),
    cardTitle: 'כרטיס בדיקה',
    cardExp: 'תוקף',
    cardId: 'ת.ז.',
    copyBtn: 'העתקת מספר',
    copied: 'הועתק!',
    copyFailed: 'ההעתקה חסומה כאן — סמנו את המספר למעלה והעתיקו ידנית (⌘/Ctrl+C).',
    openPayBtn: 'פתחו את דף התשלום',
    openAgain: 'לפתוח שוב',
    paidContinue: 'שילמתי — המשך',
    popupBlocked: 'החלון נחסם — ',
    popupOpenHere: 'פתחו את דף התשלום כאן',
    techTitlePay: '🤓 מתחת למכסה המנוע — כתובות, הפניות ו-webhook',
    techPayLp: (
      <>
        שימו לב לכתובת (URL) של דף התשלום — כרטיס התור שלנו מוטמע בתוכה. כשהתשלום מסתיים
        קורים שני דברים: הדפדפן <strong>מופנה</strong> (redirect) לכתובת הצלחה שבחרנו,
        ובמקביל קארדקום שולחים <strong>webhook</strong> — בקשת HTTP בכיוון ההפוך, השרת של
        קארדקום מתקשר לשרת שלנו — עם התוצאה. ככה המערכת שלכם יודעת על תשלומים גם אם
        הלקוח סגר את הטאב.
      </>
    ),
    techPayOf: (
      <>
        <strong>iframe</strong> הוא חלון קטן שמציג דף של אתר אחר בתוך הדף שלכם. הדף שלנו
        והחלונות של קארדקום מדברים דרך postMessage — פתקים קטנים שעוברים בין חלונות
        בדפדפן. בזכות זה מספר הכרטיס מוקלד ישירות אצל קארדקום ולא עובר בקוד שלנו — וזו
        הסיבה שמותר לנו בכלל לבנות דף כזה בלי הסמכות אבטחה מיוחדות (PCI).
      </>
    ),
    restartBtn: '↺ מהתחלה',
    openNewTab: 'לפתוח בטאב חדש במקום',
    checkBubble: (ticket) => (
      <>
        דף התשלום אמר "הצלחה" — אבל <strong>אנחנו אף פעם לא סומכים על המסך היפה</strong>.
        מסכים משקרים; לקוחות סוגרים טאבים. אז שואלים את קארדקום ישירות, שרת מול שרת:
        <em> "כרטיס התור {ticket}… באמת שולם?"</em> רק על התשובה הזאת האפליקציה שלכם
        צריכה לסמוך. עוד דבר שכדאי לדעת: על אותו כרטיס תור אפשר לנסות יותר מפעם אחת —
        אם ניסיון ראשון נדחה, ניסיון נוסף על אותו כרטיס תור זה נורמלי. מה שחשוב זה אם
        <em> איזשהו</em> ניסיון הצליח.
      </>
    ),
    askBtn: 'שאלו את קארדקום',
    asking: 'שואל את קארדקום…',
    askAgain: 'שאלו שוב',
    pending5119:
      'קארדקום אומרים: עוד אין תשלום על הכרטיס הזה. סיימו את דף התשלום בטאב השני, ואז שאלו שוב.',
    techTitleCheck: '🤓 מתחת למכסה המנוע — התשובה האמיתית',
    techCheckIntro: (
      <>
        שלחנו עוד בקשת HTTP, הפעם לנקודה בשם <strong>GetLpResult</strong>. התשובה חזרה
        כ-JSON. השדה החשוב הוא <strong>ResponseCode</strong>: אפס פירושו "שולם באמת". כל
        מספר אחר — לא לסמוך. זו התשובה בדיוק כפי שהגיעה:
      </>
    ),
    techTicketVsAttempt: (
      <>
        שני מזהים שונים חשובים כאן, והם לא אותו דבר. <strong>LowProfileId</strong>
        (כרטיס התור) הוא כל סשן התשלום — הוא יכול להישאר פתוח ליותר מניסיון אחד.
        <strong> TranzactionId</strong> הוא רק ניסיון אחד בתוך אותו סשן. ראינו את זה
        בעצמנו: ניסיון ראשון בסשן נדחה על ידי חברות האשראי, וניסיון שני על אותו כרטיס
        תור בדיוק הצליח — לכל ניסיון היה TranzactionId משלו, ResponseCode משלו, והתראת
        webhook משלו, כולם קשורים לאותו LowProfileId אחד. ניסיון שנכשל לא אומר שהסשן מת.
      </>
    ),
    doneConfirmed: (details) => (
      <>
        <strong>קארדקום אישרו!</strong> {details}
      </>
    ),
    donePaidAmount: (amount) => `שולמו ${amount} ₪`,
    doneCardEnding: (last4) => ` בכרטיס שמסתיים ב-${last4}`,
    doneTransaction: (id) => ` — עסקה מס' ${id}`,
    doneRecap: (integration) => (
      <>
        <strong>מה קרה פה, בנשימה אחת:</strong> הזמנו תשלום אצל קארדקום (כרטיס התור),
        הלקוח שילם{' '}
        {integration === 'openfields'
          ? 'בדף שלנו עם תיבות הכרטיס המאובטחות של קארדקום'
          : 'בדף המתארח של קארדקום'}
        , ואז אימתנו שרת-מול-שרת במקום לסמוך על המסך. זה כל הסיפור — כל השאר זה תוספות.
      </>
    ),
    doneReceipt: (email) => (
      <>
        קארדקום גם הפיקו קבלה ושלחו אותה ל-<strong>{email}</strong> — בדקו את תיבת הדואר
        (לפעמים זה לוקח דקה).
      </>
    ),
    runAgain: 'עוד פעם!',
    err605:
      'קארדקום ענו: חשבון הבדיקות נעול כרגע (הם נועלים אותו מחוץ לשעות העבודה, א׳–ה׳ עד 17:00). זו תשובה אמיתית מקארדקום, לא באג בטסטר. נסו שוב מאוחר יותר.',
    errGeneric: (code, description) =>
      `קארדקום החזירו שגיאה (קוד ${code}): ${description || 'בלי תיאור'}. גם התשובה הזאת שווה זהב — זה בדיוק מה שהאפליקציה שלכם תצטרך לדעת לטפל בו.`,
    errServer: (message) => `לא הצלחנו להגיע לשרת של הטסטר עצמו: ${message}`,
    spTitle: 'Spectra Payments',
    spShort: (
      <>
        ה-API של התשלומים שלנו עומד לפני קארדקום. אותו דף מתארח — אבל האפליקציה רואה רק
        לקוחות ותשלומים, אף פעם לא קארדקום גולמי.
      </>
    ),
    spLong: (
      <>
        <strong>Spectra Payments היא שיטת "שמים API משלנו מקדימה".</strong> האפליקציה
        מדברת עם <em>ה-API של התשלומים שלנו</em>, לא עם קארדקום גולמי — היא משיגה את
        הסשן, שומרת את הסודות בפנים, ומחזירה אובייקטים נקיים: לקוח, סשן תשלום, תשלום.
      </>
    ),
    createBubbleSp: (amount) => (
      <>
        קודם כול, האפליקציה אומרת ל-<strong>API של התשלומים שלנו</strong>: <em>"הלקוח הזה
        עומד לשלם {amount} ₪"</em>. מאחורי הקלעים הוא לוקח בשבילנו מספר בתור למאפייה של
        קארדקום — אבל מה שהוא מחזיר זה <strong>תשלום</strong> ו<strong>סשן תשלום</strong>
        עם מזהים משלנו. עוד לא זז שקל.
      </>
    ),
    createOkSp: (ticket) => <>ה-API שלנו אמר כן! סשן התשלום: {ticket}</>,
    techTitleCreateSp: '🤓 מתחת למכסה המנוע — API אחד לפני API אחר',
    techCreateIntroSp: (
      <>
        שתי בקשות HTTP הלכו ל-<strong>API של התשלומים שלנו</strong> (לא לקארדקום): אחת
        ליצירת לקוח, אחת לפתיחת סשן תשלום. ה-API שלנו קרא בעצמו ל-LowProfile/Create של
        קארדקום, עם הסיסמה הסודית שאף פעם לא יוצאת ממנו.
      </>
    ),
    techCreateSentSp: <>זה מה שהאפליקציה שלחה — שימו לב: בלי סיסמה, בלי שדות של קארדקום:</>,
    techCreateGotSp: (
      <>
        וזה מה שחזר. חפשו מה <em>חסר</em>: אין LowProfileId, אין ResponseCode. כרטיס התור
        של קארדקום נשאר בתוך ה-API שלנו; האפליקציה מקבלת <strong>payment_id</strong>{' '}
        ו-<strong>checkout_url</strong> לשלוח אליו את הלקוח:
      </>
    ),
    checkBubbleSp: (
      <>
        דף התשלום אמר "הצלחה" — אבל <strong>אנחנו אף פעם לא סומכים על המסך היפה</strong>.
        אז האפליקציה מבקשת מ-<strong>API של התשלומים שלנו</strong> לאמת. הוא שואל את
        קארדקום שרת-מול-שרת (אותה בדיקת GetLpResult כמו ב-Low Profile), מחליט מה התשובה
        אומרת, ורושם אותה כתשלום. הדבר היחיד שהאפליקציה מאמינה לו הוא ה<strong>סטטוס</strong>
        של התשלום.
      </>
    ),
    pendingSp:
      'ה-API שלנו אומר: התשלום עדיין PENDING — עוד לא נרשם ניסיון מוצלח. סיימו את דף התשלום, ואז אמתו שוב.',
    techTitleCheckSp: '🤓 מתחת למכסה המנוע — התשובה המנורמלת',
    techCheckIntroSp: (
      <>
        האפליקציה שלחה בקשה אחת לנקודת ה-<strong>verify</strong> של ה-API שלנו, ואז משכה
        את התשלום. זה מה שחזר:
      </>
    ),
    techCheckContrastSp: (
      <>
        השוו למסלול Low Profile: שם הקוד <em>שלכם</em> היה צריך לקרוא ResponseCode
        ו-TranzactionId ולהחליט מה הם אומרים. כאן התשובה הגולמית של קארדקום בכלל לא מגיעה
        לאפליקציה — spectra-payments כבר בדק אותה והפך אותה למילה אחת,{' '}
        <strong>SUCCEEDED</strong>. המזהים והקודים של הספק חיים בתוך ה-API שלנו, אז אם
        הספק ישתנה פעם — האפליקציה לא.
      </>
    ),
    doneRecapSp: (
      <>
        <strong>מה קרה פה, בנשימה אחת:</strong> האפליקציה ביקשה מה-API של התשלומים שלנו
        לפתוח תשלום (הוא השיג בשבילנו את כרטיס התור של קארדקום), הלקוח שילם בדף המתארח של
        קארדקום, ואז ביקשנו מה-API שלנו לאמת — הוא בדק מול קארדקום שרת-מול-שרת ורשם תשלום.
        האפליקציה לא נגעה באף שדה גולמי של קארדקום.
      </>
    ),
    doneStatusSp: (status) => ` — תשלום ${status}`,
    errSpectra: (message) => `לא הצלחנו להגיע ל-spectra-payments: ${message}`,
    presentationLabel: 'הצגת התשלום',
    presentationHosted: 'מתארח',
    presentationEmbedded: 'שדות מוטמעים',
  },
}

function Mascot() {
  return (
    <svg className="gw-mascot" viewBox="0 0 48 34" aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="31" rx="6" fill="var(--accent)" />
      <rect x="1.5" y="7" width="45" height="6" fill="var(--accent-strong)" opacity="0.5" />
      <circle cx="17" cy="21" r="2.6" fill="#fff" />
      <circle cx="31" cy="21" r="2.6" fill="#fff" />
      <path d="M18 27 Q24 31 30 27" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="gw-bubble">
      <Mascot />
      <div className="gw-bubble-text">{children}</div>
    </div>
  )
}

// Collapsed by default on purpose: the main path stays one-idea-per-screen,
// and the tech teaching is one click away for whoever's curious right now.
function TechCorner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="gw-tech">
      <summary>{title}</summary>
      <div className="gw-tech-body">{children}</div>
    </details>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="gw-json" dir="ltr">{JSON.stringify(value, null, 2)}</pre>
}

function ArtTicket() {
  return (
    <svg className="gw-art" viewBox="0 0 120 80" aria-hidden="true">
      <rect x="14" y="16" width="64" height="48" rx="7" fill="var(--accent-soft-bg)" stroke="var(--accent)" strokeWidth="2.5" />
      <circle cx="14" cy="40" r="6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
      <circle cx="78" cy="40" r="6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
      <line x1="30" y1="30" x2="62" y2="30" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="30" y1="40" x2="54" y2="40" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <line x1="30" y1="50" x2="58" y2="50" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <g className="gw-art-float">
        <circle cx="98" cy="26" r="12" fill="var(--warning-bg)" stroke="var(--warning)" strokeWidth="2.5" />
        <text x="98" y="31" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--warning)">₪</text>
      </g>
    </svg>
  )
}

function ArtDetective() {
  return (
    <svg className="gw-art" viewBox="0 0 120 80" aria-hidden="true">
      <rect x="12" y="12" width="60" height="56" rx="7" fill="var(--accent-soft-bg)" stroke="var(--accent)" strokeWidth="2.5" />
      <line x1="24" y1="28" x2="60" y2="28" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <line x1="24" y1="40" x2="52" y2="40" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
      <line x1="24" y1="52" x2="56" y2="52" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
      <g className="gw-art-float">
        <circle cx="82" cy="42" r="17" fill="var(--surface)" stroke="var(--accent-strong)" strokeWidth="3.5" />
        <line x1="94" y1="55" x2="106" y2="67" stroke="var(--accent-strong)" strokeWidth="5" strokeLinecap="round" />
        <path d="M74 42 l6 6 l11 -12" stroke="var(--success)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function ArtTrophy() {
  return (
    <svg className="gw-art" viewBox="0 0 120 80" aria-hidden="true">
      <g className="gw-art-float">
        <path d="M45 14 h30 v18 a15 15 0 0 1 -30 0 z" fill="var(--warning-bg)" stroke="var(--warning)" strokeWidth="2.5" />
        <path d="M45 18 h-9 a9 9 0 0 0 9 12" fill="none" stroke="var(--warning)" strokeWidth="2.5" />
        <path d="M75 18 h9 a9 9 0 0 1 -9 12" fill="none" stroke="var(--warning)" strokeWidth="2.5" />
        <rect x="55" y="46" width="10" height="8" fill="var(--warning)" opacity="0.7" />
        <rect x="47" y="54" width="26" height="7" rx="2" fill="var(--warning)" />
      </g>
      <rect className="gw-confetti gw-confetti-1" x="20" y="20" width="6" height="6" rx="1" fill="var(--accent)" />
      <rect className="gw-confetti gw-confetti-2" x="96" y="16" width="6" height="6" rx="1" fill="var(--success)" />
      <rect className="gw-confetti gw-confetti-3" x="102" y="52" width="5" height="5" rx="1" fill="var(--warning)" />
      <rect className="gw-confetti gw-confetti-4" x="14" y="56" width="5" height="5" rx="1" fill="var(--danger)" />
    </svg>
  )
}

function SuccessCheck() {
  return (
    <svg className="gw-check" viewBox="0 0 52 52" aria-hidden="true">
      <circle className="gw-check-circle" cx="26" cy="26" r="23" fill="none" stroke="var(--success)" strokeWidth="3" />
      <path className="gw-check-mark" d="M15 27 l8 8 l15 -17" fill="none" stroke="var(--success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Device step art: four small animated scenes (CSS keyframes in index.css --
// .gw-anim-*; all stop under prefers-reduced-motion).
function DeviceArt({ kind }: { kind: DeviceChoice }) {
  if (kind === 'phone-app') {
    return (
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <rect x="42" y="4" width="36" height="72" rx="6" fill="var(--surface-alt)" stroke="var(--border-strong)" strokeWidth="2.5" />
        <rect x="46" y="10" width="28" height="60" rx="3" fill="var(--surface)" />
        <rect x="55" y="6" width="10" height="2" rx="1" fill="var(--border-strong)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            className="gw-anim-pop"
            style={{ animationDelay: `${i * 0.12}s` }}
            x={49 + (i % 3) * 8}
            y={14 + Math.floor(i / 3) * 8}
            width="6"
            height="6"
            rx="1.5"
            fill="var(--accent)"
            opacity={i === 4 ? 1 : 0.35}
          />
        ))}
        <rect x="49" y="36" width="22" height="26" rx="3" fill="var(--accent-soft-bg)" stroke="var(--accent)" strokeWidth="1.5" />
        <rect x="52" y="41" width="16" height="3" rx="1.5" fill="var(--accent)" opacity="0.5" />
        <rect x="52" y="47" width="11" height="3" rx="1.5" fill="var(--accent)" opacity="0.3" />
        <rect x="52" y="54" width="16" height="5" rx="2" fill="var(--accent)" />
        <circle className="gw-anim-tap" cx="60" cy="56.5" r="3" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      </svg>
    )
  }
  if (kind === 'phone-web') {
    return (
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <rect x="42" y="4" width="36" height="72" rx="6" fill="var(--surface-alt)" stroke="var(--border-strong)" strokeWidth="2.5" />
        <rect x="46" y="10" width="28" height="60" rx="3" fill="var(--surface)" />
        <rect x="48" y="13" width="24" height="6" rx="3" fill="var(--surface-alt)" stroke="var(--border-strong)" strokeWidth="1" />
        <circle cx="51.5" cy="16" r="1.2" fill="var(--success)" />
        <rect x="54" y="15" width="14" height="2" rx="1" fill="var(--border-strong)" />
        <rect className="gw-anim-scan" x="48" y="20.5" width="24" height="1.5" rx="0.75" fill="var(--accent)" />
        <rect x="49" y="25" width="22" height="7" rx="2" fill="var(--accent)" opacity="0.15" />
        <rect x="49" y="35" width="22" height="7" rx="2" fill="var(--accent)" opacity="0.15" />
        <rect x="49" y="45" width="22" height="7" rx="2" fill="var(--accent)" opacity="0.15" />
        <rect x="49" y="56" width="22" height="6" rx="2" fill="var(--accent)" />
      </svg>
    )
  }
  if (kind === 'tablet') {
    return (
      <svg viewBox="0 0 120 80" aria-hidden="true" className="gw-anim-float">
        <rect x="24" y="6" width="72" height="68" rx="6" fill="var(--surface-alt)" stroke="var(--border-strong)" strokeWidth="2.5" />
        <rect x="30" y="12" width="60" height="56" rx="3" fill="var(--surface)" />
        <rect x="38" y="22" width="44" height="34" rx="4" fill="var(--accent-soft-bg)" stroke="var(--accent)" strokeWidth="1.5" />
        <rect x="43" y="28" width="20" height="3" rx="1.5" fill="var(--accent)" opacity="0.5" />
        <rect x="43" y="34" width="34" height="3" rx="1.5" fill="var(--accent)" opacity="0.3" />
        <rect x="43" y="40" width="34" height="3" rx="1.5" fill="var(--accent)" opacity="0.3" />
        <rect x="43" y="47" width="34" height="5" rx="2" fill="var(--accent)" />
        <circle cx="60" cy="71" r="1.5" fill="var(--border-strong)" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true">
      <rect x="18" y="8" width="84" height="52" rx="4" fill="var(--surface-alt)" stroke="var(--border-strong)" strokeWidth="2.5" />
      <rect x="23" y="13" width="74" height="42" rx="2" fill="var(--surface)" />
      <rect x="10" y="62" width="100" height="6" rx="3" fill="var(--border-strong)" />
      <rect x="47" y="60" width="26" height="3" fill="var(--border-strong)" opacity="0.6" />
      <rect x="30" y="20" width="26" height="28" rx="3" fill="var(--accent)" opacity="0.15" />
      <rect x="61" y="20" width="30" height="28" rx="3" fill="var(--accent-soft-bg)" stroke="var(--accent)" strokeWidth="1.5" />
      <rect x="65" y="25" width="18" height="3" rx="1.5" fill="var(--accent)" opacity="0.5" />
      <rect x="65" y="31" width="22" height="3" rx="1.5" fill="var(--accent)" opacity="0.3" />
      <rect x="65" y="39" width="22" height="5" rx="2" fill="var(--accent)" />
      <path className="gw-anim-cursor" d="M70 36 l0 9 l2.5 -2.2 l1.8 3.6 l1.6 -0.8 l-1.8 -3.5 l3.2 -0.4 z" fill="var(--text)" stroke="var(--surface)" strokeWidth="0.8" />
    </svg>
  )
}

type GuidedWalkthroughProps = {
  disabled?: boolean
  lang: Lang
  // The business this run acts as -- owned by App so the other tabs follow it.
  profile: BusinessProfile
  onProfileChange: (id: string) => void
}

export function GuidedWalkthrough({ disabled, lang, profile, onProfileChange }: GuidedWalkthroughProps) {
  const viewport = useViewport()
  const [step, setStep] = useState<GuidedStep>('intro')
  const [integration, setIntegration] = useState<Integration>('lowprofile')
  const [picked, setPicked] = useState<Integration | null>(null)
  const [device, setDevice] = useState<DeviceChoice | null>(null)
  const [region, setRegion] = useState<OpenFieldsRegion>('il')
  // The pretend cart stands in for the merchant's app; its total is the amount.
  const [cartItems, setCartItems] = useState<CartItem[]>(DEFAULT_CART)
  const amount = cartTotal(cartItems).toFixed(2)
  const cartLang = lang === 'he' ? ('he' as const) : ('en' as const)
  const cartLineItems = apiLineItems(cartItems, cartLang)
  const [cartView, setCartView] = useState<'store' | 'cart'>('store')
  const [wantReceipt, setWantReceipt] = useState(false)
  const [receiptEmail, setReceiptEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState<CardcomPayload | null>(null)
  const [createSent, setCreateSent] = useState<CardcomPayload | null>(null)
  const [result, setResult] = useState<CardcomPayload | null>(null)
  const [payOpened, setPayOpened] = useState(false)
  const [payOverlayOpen, setPayOverlayOpen] = useState(false)
  const [payFallbackUrl, setPayFallbackUrl] = useState('')
  const [copied, setCopied] = useState(false)
  // Spectra path state -- our own Payment API's objects, never raw Cardcom payloads.
  const [spectraCustomer, setSpectraCustomer] = useState<SpectraCustomer | null>(null)
  const [spectraSession, setSpectraSession] = useState<SpectraCheckoutSession | null>(null)
  const [spectraVerify, setSpectraVerify] = useState<SpectraVerifyResult | null>(null)
  const [spectraPayment, setSpectraPayment] = useState<SpectraPayment | null>(null)
  const [spectraPresentation, setSpectraPresentation] = useState<'hosted' | 'embedded_fields'>(
    'hosted',
  )
  // Payment-page look (our Open Fields page only -- Cardcom's hosted page
  // can't be themed from here). Accent starts from the business's own colour.
  const [pageTheme, setPageTheme] = useState<PageTheme>('system')
  const [accent, setAccent] = useState(profile.accent)
  // 1 = the real Google Pay only; 2-4 add mock wallets to preview the row.
  const [mockWallets, setMockWallets] = useState(1)
  const [dualMode, setDualMode] = useState<DualMode>('side-by-side')

  const t = COPY[lang]
  // One choice drives both the walkthrough interface AND the payment page.
  const language: Language = lang

  const lowProfileId = asText(session?.LowProfileId)
  const sessionCode = responseCode(session)
  const resultCode = responseCode(result)
  const isOpenFields = integration === 'openfields'
  const isSpectra = integration === 'spectra'
  const amountNumber = Number(amount) || 0
  // The receipt option belongs to the raw-Cardcom paths only (post-hoc documents
  // through our own API are a later slice) -- it never gates the Spectra path.
  const receiptReady = isSpectra || !wantReceipt || receiptEmail.includes('@')

  // Desktop: the two-panel view -- your-own-app order summary beside the real
  // payment frame (the same panel the Design tab's "double view" uses), so the
  // Open Fields page skips its own cart screen. Phones and tablets have no
  // room for it.
  const sideBySide = device === 'desktop' && viewport.device !== 'mobile'
  const spectraSessionReference = spectraSession?.bootstrap?.session_reference ?? ''
  const payUrl = isSpectra
    ? spectraPresentation === 'embedded_fields'
      ? spectraSessionReference
        ? openFieldsUrl(language, {
            lpid: spectraSessionReference,
            region,
            amount: amountNumber,
            brand: profile.id,
            theme: pageTheme,
            accent,
            testFill: true,
            wallets: mockWallets,
            embed: device === 'phone-app' || sideBySide,
            screen: sideBySide ? 'checkout' : undefined,
            layout: sideBySide ? 'split' : undefined,
          })
        : ''
      : asText(spectraSession?.checkout_url)
    : isOpenFields
      ? lowProfileId
        ? openFieldsUrl(language, {
            lpid: lowProfileId,
            region,
            amount: amountNumber,
            brand: profile.id,
            theme: pageTheme,
            accent,
            testFill: true,
            wallets: mockWallets,
            embed: device === 'phone-app' || sideBySide,
            screen: sideBySide ? 'checkout' : undefined,
            layout: sideBySide ? 'split' : undefined,
          })
        : ''
      : asText(session?.Url || session?.url)
  // Payment-page look controls -- shown once, on the business step (only
  // our own Open Fields page takes them; Cardcom's hosted page ignores them).
  const lookControls = (
    <div className="gw-field">
      {t.lookLabel}
      <div className="gw-look">
        <div className="seg seg--small" role="radiogroup" aria-label={t.lookLabel}>
          {PAGE_THEMES.map((option) => (
            <button
              key={option}
              type="button"
              className={`seg-btn${pageTheme === option ? ' is-on' : ''}`}
              disabled={disabled}
              onClick={() => {
                playClick()
                setPageTheme(option)
              }}
            >
              {t.themeLabels[option]}
            </button>
          ))}
        </div>
        <div className="gw-accent">
          <span className="gw-accent-title">{t.accentLabel}</span>
          <div className="gw-swatches" role="radiogroup" aria-label={t.accentLabel}>
            {ACCENT_PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                className={`gw-swatch${accent === hex ? ' is-on' : ''}`}
                style={{ background: hex }}
                aria-label={hex}
                aria-pressed={accent === hex}
                disabled={disabled}
                onClick={() => {
                  playClick()
                  setAccent(hex)
                }}
              />
            ))}
          </div>
          <label className="gw-accent-custom" title={t.accentLabel}>
            <input
              type="color"
              value={accent}
              disabled={disabled}
              aria-label={t.accentLabel}
              onInput={(event) => setAccent((event.target as HTMLInputElement).value)}
              onChange={(event) => setAccent(event.target.value)}
            />
            <code dir="ltr">{accent}</code>
          </label>
        </div>
        {isOpenFields ? (
          // Cardcom's own hosted Low Profile page decides its wallets on its
          // own (whatever the real terminal has enabled) -- this mock-count
          // picker only means anything on our own Open Fields page, which
          // renders its wallet row itself.
          <div className="seg seg--small" role="radiogroup" aria-label={t.walletsLabel}>
            <span className="seg-label">{t.walletsLabel}</span>
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                className={`seg-btn${mockWallets === count ? ' is-on' : ''}`}
                disabled={disabled}
                onClick={() => {
                  playClick()
                  setMockWallets(count)
                }}
              >
                {count}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
  // "Session created" for whichever path is active -- drives the create step.
  const createOk = isSpectra ? Boolean(spectraSession) : sessionCode === 0

  const goTo = (next: GuidedStep) => {
    setError('')
    setStep(next)
    if (next === 'done') playSuccess()
    else playStep()
  }

  const clearRun = () => {
    setSession(null)
    setCreateSent(null)
    setResult(null)
    setSpectraCustomer(null)
    setSpectraSession(null)
    setSpectraVerify(null)
    setSpectraPayment(null)
    setPayOpened(false)
    setPayOverlayOpen(false)
    setPayFallbackUrl('')
    setError('')
  }

  // "Run it again" keeps you in the flow; the global restart button starts
  // the whole story over from the intro.
  const runAgainFromDone = () => {
    clearRun()
    setPicked(null)
    goTo('pick')
  }

  const restartAll = () => {
    clearRun()
    setPicked(null)
    goTo('intro')
  }

  const friendlyCardcomError = (code: number | null, description: string) => {
    if (code === 605) return t.err605
    return t.errGeneric(String(code ?? '?'), description)
  }

  const runCreate = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setSession(null)
    setCreateSent(null)
    setResult(null)
    setSpectraSession(null)
    setSpectraVerify(null)
    setSpectraPayment(null)
    setPayOpened(false)
    if (isSpectra) {
      // Our own Payment API does the Cardcom call for us -- two requests, both to
      // spectra-payments, zero raw-Cardcom fields in either direction. spectra-payments
      // is the ONLY creator of the LowProfile session for either presentation -- no
      // /payment, no /lab/create, ever, from this branch.
      //
      // spectraCustomer is deliberately NOT reset here: a retry after a
      // CheckoutSession/LowProfile failure must reuse the Customer this run
      // already created, not manufacture a second one for the same attempt.
      // clearRun() (restart / run-again / profile change) is the only thing
      // that clears it back to null for a genuinely new run.
      try {
        const customer = await resolveSpectraCustomer(spectraCustomer, () =>
          createCustomer({ displayName: 'Guided Tester' }, profile.spectraProjectId),
        )
        setSpectraCustomer(customer)
        const created =
          spectraPresentation === 'embedded_fields'
            ? await createEmbeddedFieldsCheckoutSession({
                customerId: customer.id,
                amount: amountNumber,
                language,
                projectId: profile.spectraProjectId,
                lineItems: cartLineItems,
              })
            : await createHostedCheckoutSession({
                customerId: customer.id,
                amount: amountNumber,
                language,
                projectId: profile.spectraProjectId,
                lineItems: cartLineItems,
              })
        setSpectraSession(created)
      } catch (cause) {
        setError(t.errSpectra(cause instanceof Error ? cause.message : ''))
        playError()
      }
      setBusy(false)
      return
    }
    try {
      const data = await createLabSession({
        profileId: profile.expressProfileId,
        language,
        // A receipt needs a Document with an Email on it -- the 'customer'
        // scenario is the existing lab path that builds exactly that.
        scenario: wantReceipt ? 'customer' : 'charge',
        amount,
        documentType: 'Receipt',
        returnValue: 'guided-run',
        // The cart's real lines become the receipt's product lines (Cardcom's
        // rule: they must sum to the charge -- they do, by construction).
        products: resolveItems(cartItems, cartLang).map((item) => ({
          ...newProduct(),
          description: item.name,
          quantity: String(item.qty),
          unitCost: item.price.toFixed(2),
        })),
        customer: {
          name: 'Guided Tester',
          taxId: '',
          email: wantReceipt ? receiptEmail.trim() : '',
          isSendByEmail: wantReceipt,
          addressLine1: '',
          city: '',
          mobile: '',
        },
      })
      const cardcom = asRecord(data.cardcom)
      setSession(cardcom)
      setCreateSent(asRecord(data.sent))
      const code = responseCode(cardcom)
      if (code !== 0) {
        setError(friendlyCardcomError(code, asText(cardcom?.Description)))
        playError()
      }
    } catch (cause) {
      setError(t.errServer(cause instanceof Error ? cause.message : ''))
      playError()
    }
    setBusy(false)
  }

  // Default: pay right here, in an in-page frame (no popup blockers, and the
  // frame's width keeps Cardcom's page in its good narrow layout). A new-tab
  // escape hatch stays for anything a frame can't do.
  const openPay = () => {
    if (!payUrl) return
    setPayOverlayOpen(true)
    setPayOpened(true)
    setPayFallbackUrl('')
  }

  const openPayNewTab = () => {
    if (!payUrl) return
    const tab = window.open(payUrl, '_blank', 'noopener,noreferrer')
    setPayFallbackUrl(tab ? '' : payUrl)
    setPayOpened(true)
  }

  // Frame size by real viewport: phones get the full screen; bigger screens
  // get a wide stage for BOTH paths so the whole page fits with no inner
  // scrolling. Open Fields height is measured (872-890px content at its
  // two-column width); the real Cardcom hosted page also needs the width --
  // above its 600px breakpoint it lays the order summary beside the form,
  // which is much shorter than the 520px single-column stack that forced
  // scrolling here before.
  // The device step narrows this: phone frames at real phone sizes (in-app a
  // little shorter, like a WebView under an app bar), tablet portrait, and
  // desktop as before. On a real phone the frame is always the full screen.
  const overlaySize =
    viewport.device === 'mobile'
      ? {}
      : device === 'phone-app'
        ? { width: 390, height: 780 }
        : device === 'phone-web'
          ? { width: 390, height: 844 }
          : device === 'tablet'
            ? { width: 768, height: 1024 }
            : {
                // The payment column; PaymentOverlay adds the 420px summary
                // column beside it -- ~1080px in all, like a Stripe checkout.
                width: Math.min(660, viewport.width - 40),
                height: Math.min(940, viewport.height - 40),
              }
  const deviceFrame =
    viewport.device === 'mobile'
      ? undefined
      : device === 'phone-app' || device === 'phone-web'
        ? 'phone'
        : device === 'tablet'
          ? 'tablet'
          : undefined
  // The stage and the summary column follow the payment page's theme/accent,
  // so the two panels read as one page.
  const resolvedTheme: 'light' | 'dark' =
    pageTheme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : pageTheme
  const summarySrc = `/cardcom-preview/order-summary.html?${new URLSearchParams({
    amount: String(amountNumber),
    brand: profile.id,
    lang: language === 'en' ? 'en' : 'he',
    theme: resolvedTheme,
    accent: accent.replace(/^#/, ''),
    // The summary renders the cart's own lines instead of its stock two.
    items: JSON.stringify(resolveItems(cartItems, cartLang).map((item) => ({ n: item.name, p: item.price, q: item.qty }))),
  })}`

  const runCheck = async () => {
    if (busy) return
    if (isSpectra) {
      if (!spectraSession) return
      setBusy(true)
      setError('')
      try {
        // Authoritative verification through OUR API (it runs GetLpResult itself),
        // then the persisted Payment -- the only thing the app should believe.
        const verified = await verifyCheckoutSession(
          spectraSession.checkout_session_id,
          profile.spectraProjectId,
        )
        setSpectraVerify(verified)
        const payment = await getPayment(verified.payment_id, profile.spectraProjectId)
        setSpectraPayment(payment)
        if (payment.status === 'SUCCEEDED') goTo('done')
      } catch (cause) {
        setError(t.errSpectra(cause instanceof Error ? cause.message : ''))
        playError()
      }
      setBusy(false)
      return
    }
    if (!lowProfileId) return
    setBusy(true)
    setError('')
    try {
      const data = await checkLabResult(lowProfileId, profile.expressProfileId)
      const cardcom = asRecord(data.cardcom)
      setResult(cardcom)
      if (responseCode(cardcom) === 0) goTo('done')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'GetLpResult failed')
      playError()
    }
    setBusy(false)
  }

  const copyCard = async () => {
    // Always the RAW digits (no spaces) -- Cardcom's card field rejects a
    // pasted "4580 2800 ..." with spaces. The async Clipboard API is blocked in
    // some browsers/privacy modes and rejects silently; fall back to a hidden
    // textarea + execCommand so the button never appears to do nothing.
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(TEST_CARD_RAW)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = TEST_CARD_RAW
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        ok = document.execCommand('copy')
        textarea.remove()
      } catch {
        ok = false
      }
    }
    if (ok) {
      playClick()
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } else {
      // Both paths blocked: tell the tester to select the number by hand rather
      // than leave a dead button and a stale clipboard.
      setError(t.copyFailed)
      playError()
    }
  }

  const dots: { id: GuidedStep; label: string }[] = [
    { id: 'profile', label: t.dots[0] },
    { id: 'pick', label: t.dots[1] },
    { id: 'device', label: t.dots[2] },
    { id: 'setup', label: t.dots[3] },
    { id: 'create', label: t.dots[4] },
    { id: 'pay', label: t.dots[5] },
    { id: 'check', label: t.dots[6] },
  ]
  const dotIndex = dots.findIndex((dot) => dot.id === step)
  const transaction = asRecord(result?.TranzactionInfo)
  const last4 = asText(transaction?.Last4CardDigitsString || transaction?.Last4CardDigits)
  const tranId = asText(transaction?.TranzactionId || transaction?.TransactionId)

  // Compact real-payload views for the tech corners -- honest excerpts, not
  // mockups, but trimmed so they never overwhelm the screen.
  const sentPreview = createSent
    ? {
        Amount: createSent.Amount,
        Language: createSent.Language,
        Operation: createSent.Operation,
      }
    : null
  const gotPreview = session
    ? {
        ResponseCode: session.ResponseCode,
        Description: session.Description,
        LowProfileId: session.LowProfileId,
        Url: asText(session.Url || session.url).slice(0, 60) + '…',
      }
    : null
  const resultPreview = result
    ? {
        ResponseCode: result.ResponseCode,
        Description: result.Description,
        TranzactionInfo: transaction
          ? { Amount: transaction.Amount, TranzactionId: transaction.TranzactionId }
          : undefined,
      }
    : null

  // Spectra path views: shown exactly as our own API returns them (no Cardcom
  // vocabulary exists in them to strip -- that absence is the lesson).
  const spectraSessionId = spectraSession?.checkout_session_id ?? ''
  const spectraSentPreview = spectraCustomer
    ? {
        project_id: profile.spectraProjectId,
        customer_id: spectraCustomer.id,
        amount: amountNumber.toFixed(2),
        currency: 'ILS',
        checkout_mode: spectraPresentation,
      }
    : null
  const spectraGotPreview = spectraSession
    ? {
        checkout_session_id: spectraSession.checkout_session_id,
        status: spectraSession.status,
        payment_id: spectraSession.payment_id,
        payment_status: spectraSession.payment_status,
        // Shown exactly as the response actually shapes it per presentation -- hosted
        // gets checkout_url, embedded_fields gets bootstrap.session_reference (the one
        // Cardcom-adjacent value the API deliberately DOES expose, opaquely, since the
        // embedded presentation genuinely needs it to initialize).
        ...(spectraSession.checkout_mode === 'embedded_fields'
          ? { bootstrap: spectraSession.bootstrap }
          : { checkout_url: asText(spectraSession.checkout_url).slice(0, 60) + '…' }),
      }
    : null
  const spectraCheckPreview = spectraPayment
    ? {
        verify: spectraVerify,
        payment: {
          id: spectraPayment.id,
          status: spectraPayment.status,
          amount: spectraPayment.amount,
          currency: spectraPayment.currency,
          source: spectraPayment.source,
        },
      }
    : null

  return (
    <div className="gw" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {step !== 'intro' ? (
        <button type="button" className="text-btn gw-restart" disabled={disabled} onClick={restartAll}>
          {t.restartBtn}
        </button>
      ) : null}

      {step !== 'intro' ? (
        <ol className="gw-dots" aria-label="Walkthrough progress">
          {dots.map((dot, index) => (
            <li
              key={dot.id}
              className={`gw-dot${index < dotIndex || step === 'done' ? ' is-done' : ''}${index === dotIndex ? ' is-now' : ''}`}
            >
              <span className="gw-dot-bead" aria-hidden="true" />
              {dot.label}
            </li>
          ))}
        </ol>
      ) : null}

      {step === 'intro' ? (
        <section className="gw-step" key="intro">
          <ArtTicket />
          <Bubble>{t.introBubble}</Bubble>
          <div className="gw-actions">
            <button type="button" className="cta-button gw-pulse" disabled={disabled} onClick={() => goTo('profile')}>
              {t.introGo}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'profile' ? (
        <section className="gw-step" key="profile">
          <Bubble>{t.profileBubble}</Bubble>
          <div className="gw-form gw-form--business">
            <div className="gw-field">
              {t.profileLabel}
              <div className="gw-profile-picker">
                <picture>
                  <source srcSet={profile.logoDark} media="(prefers-color-scheme: dark)" />
                  <img src={profile.logoLight} alt="" />
                </picture>
                <MenuSelect
                  aria-label={t.profileLabel}
                  value={profile.id}
                  options={PROFILES.map((option) => ({ value: option.id, label: option.name }))}
                  disabled={disabled}
                  onChange={(next) => {
                    playClick()
                    // A different business is a different spectra-payments
                    // project_id -- clear any Customer/session this run
                    // already holds before it, or a later Spectra retry
                    // could reuse a Customer that belongs to the OLD
                    // business's project.
                    clearRun()
                    setAccent(profileById(next).accent)
                    onProfileChange(next)
                  }}
                />
              </div>
            </div>
            {lookControls}
          </div>
          <div className="gw-picked-reveal" key={profile.id}>
            <Bubble>{t.profileLong(profile.name)}</Bubble>
            <div className="gw-actions">
              <button type="button" className="cta-button gw-pulse" disabled={disabled} onClick={() => goTo('pick')}>
                {t.continueBtn}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 'pick' ? (
        <section className="gw-step" key="pick">
          <Bubble>{t.pickBubble}</Bubble>
          <div className="gw-choices">
            <button
              type="button"
              className={`gw-choice${picked === 'lowprofile' ? ' is-picked' : ''}`}
              aria-pressed={picked === 'lowprofile'}
              disabled={disabled}
              onClick={() => {
                playClick()
                setPicked('lowprofile')
                setIntegration('lowprofile')
              }}
            >
              <svg viewBox="0 0 120 80" aria-hidden="true">
                <rect x="18" y="10" width="84" height="60" rx="7" fill="var(--accent-soft-bg)" stroke="var(--accent)" strokeWidth="2.5" />
                <rect x="18" y="10" width="84" height="14" rx="7" fill="var(--accent)" />
                <circle cx="27" cy="17" r="2.5" fill="#fff" />
                <circle cx="35" cy="17" r="2.5" fill="#fff" />
                <rect x="30" y="34" width="60" height="8" rx="3" fill="var(--accent)" opacity="0.5" />
                <rect x="30" y="48" width="42" height="8" rx="3" fill="var(--accent)" opacity="0.3" />
              </svg>
              <strong>{t.lpTitle}</strong>
              <span>{t.lpShort}</span>
            </button>
            <button
              type="button"
              className={`gw-choice${picked === 'openfields' ? ' is-picked' : ''}`}
              aria-pressed={picked === 'openfields'}
              disabled={disabled}
              onClick={() => {
                playClick()
                setPicked('openfields')
                setIntegration('openfields')
              }}
            >
              <svg viewBox="0 0 120 80" aria-hidden="true">
                <rect x="18" y="10" width="84" height="60" rx="7" fill="var(--surface-alt)" stroke="var(--border-strong)" strokeWidth="2.5" />
                <rect x="26" y="20" width="50" height="9" rx="3" fill="var(--border-strong)" opacity="0.7" />
                <rect x="26" y="36" width="68" height="10" rx="3" fill="var(--warning-bg)" stroke="var(--warning)" strokeWidth="2" />
                <rect x="26" y="52" width="30" height="10" rx="3" fill="var(--warning-bg)" stroke="var(--warning)" strokeWidth="2" />
              </svg>
              <strong>{t.ofTitle}</strong>
              <span>{t.ofShort}</span>
            </button>
            <button
              type="button"
              className={`gw-choice${picked === 'spectra' ? ' is-picked' : ''}`}
              aria-pressed={picked === 'spectra'}
              disabled={disabled}
              onClick={() => {
                playClick()
                setPicked('spectra')
                setIntegration('spectra')
              }}
            >
              <svg viewBox="0 0 120 80" aria-hidden="true">
                <rect x="10" y="8" width="100" height="64" rx="8" fill="var(--accent-soft-bg)" stroke="var(--accent)" strokeWidth="2.5" />
                <rect x="10" y="8" width="100" height="14" rx="8" fill="var(--accent)" />
                <circle cx="19" cy="15" r="2.5" fill="#fff" />
                <circle cx="27" cy="15" r="2.5" fill="#fff" />
                <rect x="24" y="32" width="72" height="30" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />
                <rect x="32" y="40" width="40" height="6" rx="3" fill="var(--accent)" opacity="0.5" />
                <rect x="32" y="50" width="26" height="6" rx="3" fill="var(--accent)" opacity="0.3" />
              </svg>
              <strong>{t.spTitle}</strong>
              <span>{t.spShort}</span>
            </button>
          </div>
          {picked ? (
            // Keyed so switching picks replays the pop-in with the new text.
            <div className="gw-picked-reveal" key={picked}>
              <Bubble>
                {picked === 'lowprofile' ? t.lpLong : picked === 'openfields' ? t.ofLong : t.spLong}
              </Bubble>
              <div className="gw-actions">
                <button
                  type="button"
                  className="cta-button gw-pulse"
                  disabled={disabled}
                  onClick={() => goTo('device')}
                >
                  {t.continueBtn}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'device' ? (
        <section className="gw-step" key="device">
          <Bubble>{t.deviceBubble}</Bubble>
          <div className="gw-choices gw-choices--devices">
            {DEVICE_CHOICES.map((option) => (
              <button
                key={option}
                type="button"
                className={`gw-choice gw-device gw-device--${option}${device === option ? ' is-picked' : ''}`}
                aria-pressed={device === option}
                disabled={disabled}
                onClick={() => {
                  playClick()
                  setDevice(option)
                }}
              >
                <DeviceArt kind={option} />
                <strong>{t.deviceTitles[option]}</strong>
                <span>{t.deviceShorts[option]}</span>
              </button>
            ))}
          </div>
          {device ? (
            <div className="gw-picked-reveal" key={device}>
              <Bubble>{t.deviceLong[device]}</Bubble>
              {device === 'desktop' ? (
                <div className="gw-field gw-field--center">
                  {t.layoutLabel}
                  <div className="seg seg--small" role="radiogroup" aria-label={t.layoutLabel}>
                    {DUAL_MODES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`seg-btn${dualMode === option ? ' is-on' : ''}`}
                        disabled={disabled}
                        onClick={() => {
                          playClick()
                          setDualMode(option)
                        }}
                      >
                        {t.layoutLabels[option]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="gw-actions">
                <button type="button" className="text-btn" onClick={() => goTo('pick')}>
                  {t.backBtn}
                </button>
                <button
                  type="button"
                  className="cta-button gw-pulse"
                  disabled={disabled}
                  onClick={() => goTo('setup')}
                >
                  {t.continueBtn}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'setup' ? (
        <section className="gw-step" key="setup">
          {cartView === 'store' ? <Bubble>{t.setupBubble}</Bubble> : null}
          <GuidedCart
            lang={cartLang}
            items={cartItems}
            onChange={setCartItems}
            disabled={disabled}
            brandName={profile.name}
            onViewChange={setCartView}
            onBack={() => goTo('pick')}
            onCheckout={() => goTo('create')}
            checkoutDisabled={disabled || !(amountNumber > 0) || !receiptReady}
            options={<div className="gw-form">
            {isSpectra ? (
              <div className="gw-field">
                {t.presentationLabel}
                <div className="seg" role="radiogroup" aria-label={t.presentationLabel}>
                  <button
                    type="button"
                    className={`seg-btn${spectraPresentation === 'hosted' ? ' is-on' : ''}`}
                    disabled={disabled}
                    onClick={() => setSpectraPresentation('hosted')}
                  >
                    {t.presentationHosted}
                  </button>
                  <button
                    type="button"
                    className={`seg-btn${spectraPresentation === 'embedded_fields' ? ' is-on' : ''}`}
                    disabled={disabled}
                    onClick={() => setSpectraPresentation('embedded_fields')}
                  >
                    {t.presentationEmbedded}
                  </button>
                </div>
              </div>
            ) : null}
            {isOpenFields || (isSpectra && spectraPresentation === 'embedded_fields') ? (
              <div className="gw-field">
                {t.templateLabel}
                <div className="seg" role="radiogroup" aria-label={t.templateLabel}>
                  {OPEN_FIELDS_REGIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`seg-btn${region === option.value ? ' is-on' : ''}`}
                      disabled={disabled}
                      onClick={() => setRegion(option.value)}
                    >
                      {t.regionLabels[option.value]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {!isSpectra ? (
              <label className="gw-receipt-toggle">
                <input
                  type="checkbox"
                  checked={wantReceipt}
                  disabled={disabled}
                  onChange={(event) => setWantReceipt(event.target.checked)}
                />
                {t.receiptToggle}
              </label>
            ) : null}
            {wantReceipt && !isSpectra ? (
              <label className="gw-field">
                {t.receiptEmailLabel}
                <input
                  value={receiptEmail}
                  type="email"
                  dir="ltr"
                  disabled={disabled}
                  placeholder="you@example.com"
                  onChange={(event) => setReceiptEmail(event.target.value)}
                />
              </label>
            ) : null}
          </div>}
          />
        </section>
      ) : null}

      {step === 'create' ? (
        <section className="gw-step" key="create">
          <ArtTicket />
          <Bubble>{isSpectra ? t.createBubbleSp(amountNumber) : t.createBubble(amountNumber)}</Bubble>
          {createOk ? (
            <div className="gw-result gw-result--ok">
              <SuccessCheck />
              <p>
                {isSpectra
                  ? t.createOkSp(
                      <code dir="ltr">
                        {spectraSessionId.slice(0, 8)}…{spectraSessionId.slice(-4)}
                      </code>,
                    )
                  : t.createOk(
                      <code dir="ltr">
                        {lowProfileId.slice(0, 8)}…{lowProfileId.slice(-4)}
                      </code>,
                    )}
              </p>
            </div>
          ) : null}
          {error ? <p className="gw-error">{error}</p> : null}
          {createOk && isSpectra ? (
            <TechCorner title={t.techTitleCreateSp}>
              <p>{t.techCreateIntroSp}</p>
              <p>{t.techCreateSentSp}</p>
              {spectraSentPreview ? <JsonBlock value={spectraSentPreview} /> : null}
              <p>{t.techCreateGotSp}</p>
              {spectraGotPreview ? <JsonBlock value={spectraGotPreview} /> : null}
            </TechCorner>
          ) : createOk ? (
            <TechCorner title={t.techTitleCreate}>
              <p>{t.techCreateIntro}</p>
              <p>{t.techCreateSent}</p>
              {sentPreview ? <JsonBlock value={sentPreview} /> : null}
              <p>{t.techCreateGot}</p>
              {gotPreview ? <JsonBlock value={gotPreview} /> : null}
            </TechCorner>
          ) : null}
          <div className="gw-actions">
            <button type="button" className="text-btn" onClick={() => goTo('setup')}>
              {t.backBtn}
            </button>
            {createOk ? (
              <button type="button" className="cta-button gw-pulse" onClick={() => goTo('pay')}>
                {t.continueBtn}
              </button>
            ) : (
              <button
                type="button"
                className="cta-button gw-pulse"
                disabled={disabled || busy}
                onClick={() => void runCreate()}
              >
                {busy ? t.creating : error ? t.tryAgain : t.createBtn}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {step === 'pay' ? (
        <section className="gw-step" key="pay">
          <Bubble>{isOpenFields ? t.payBubbleOf : t.payBubbleLp}</Bubble>
          <div className="gw-card" dir="ltr" aria-label="Test card details">
            <span className="gw-card-brand">{t.cardTitle}</span>
            <span className="gw-card-number">{TEST_CARD_NUMBER}</span>
            <span className="gw-card-row">
              <span>
                {t.cardExp} <strong>12/30</strong>
              </span>
              <span>
                CVV <strong>123</strong>
              </span>
              <span>
                {t.cardId} <strong>000000000</strong>
              </span>
            </span>
            <button type="button" className="gw-card-copy" onClick={() => void copyCard()}>
              {copied ? t.copied : t.copyBtn}
            </button>
          </div>
          <TechCorner title={t.techTitlePay}>
            <p>{isOpenFields ? t.techPayOf : t.techPayLp}</p>
          </TechCorner>
          {payFallbackUrl ? (
            <p className="gw-error">
              {t.popupBlocked}
              <a href={payFallbackUrl} target="_blank" rel="noopener noreferrer">
                {t.popupOpenHere}
              </a>
              .
            </p>
          ) : null}
          <div className="gw-actions">
            <button type="button" className="text-btn" onClick={() => goTo('create')}>
              {t.backBtn}
            </button>
            <button type="button" className="text-btn" disabled={disabled || !payUrl} onClick={openPayNewTab}>
              {t.openNewTab}
            </button>
            {payOpened ? (
              <>
                <button type="button" className="text-btn" disabled={disabled} onClick={openPay}>
                  {t.openAgain}
                </button>
                <button type="button" className="cta-button gw-pulse" onClick={() => goTo('check')}>
                  {t.paidContinue}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="cta-button gw-pulse"
                disabled={disabled || !payUrl}
                onClick={openPay}
              >
                {t.openPayBtn}
              </button>
            )}
          </div>
          {payOverlayOpen && payUrl
            ? // Portal to <body>: .gw-step's slide-in animation retains a
              // transform (fill-mode: both), which turns it into the containing
              // block for position:fixed -- without the portal the overlay is
              // trapped inside .gw's 560px column and can never be wider.
              createPortal(
                <PaymentOverlay
                  src={payUrl}
                  onClose={() => setPayOverlayOpen(false)}
                  rtl={lang === 'he'}
                  scroll
                  frame={deviceFrame}
                  summarySrc={sideBySide ? summarySrc : undefined}
                  dualMode={dualMode}
                  theme={resolvedTheme}
                  continueLabel={t.sideBySideContinue}
                  {...overlaySize}
                />,
                document.body,
              )
            : null}
        </section>
      ) : null}

      {step === 'check' ? (
        <section className="gw-step" key="check">
          <ArtDetective />
          <Bubble>
            {isSpectra ? t.checkBubbleSp : t.checkBubble(lowProfileId ? lowProfileId.slice(0, 8) : '')}
          </Bubble>
          {isSpectra && spectraPayment && spectraPayment.status !== 'SUCCEEDED' ? (
            <p className="gw-error">{t.pendingSp}</p>
          ) : null}
          {!isSpectra && result && resultCode !== 0 ? (
            <p className="gw-error">
              {resultCode === 5119
                ? t.pending5119
                : friendlyCardcomError(resultCode, asText(result.Description))}
            </p>
          ) : null}
          {error ? <p className="gw-error">{error}</p> : null}
          {isSpectra && spectraCheckPreview ? (
            <TechCorner title={t.techTitleCheckSp}>
              <p>{t.techCheckIntroSp}</p>
              <JsonBlock value={spectraCheckPreview} />
              <p>{t.techCheckContrastSp}</p>
            </TechCorner>
          ) : null}
          {!isSpectra && result ? (
            <TechCorner title={t.techTitleCheck}>
              <p>{t.techCheckIntro}</p>
              {resultPreview ? <JsonBlock value={resultPreview} /> : null}
              <p>{t.techTicketVsAttempt}</p>
            </TechCorner>
          ) : null}
          <div className="gw-actions">
            <button type="button" className="text-btn" onClick={() => goTo('pay')}>
              {t.backBtn}
            </button>
            <button
              type="button"
              className="cta-button gw-pulse"
              disabled={disabled || busy || (isSpectra ? !spectraSession : !lowProfileId)}
              onClick={() => void runCheck()}
            >
              {busy ? t.asking : result || spectraVerify ? t.askAgain : t.askBtn}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'done' ? (
        <section className="gw-step" key="done">
          <ArtTrophy />
          <div className="gw-result gw-result--ok">
            <SuccessCheck />
            <p>
              {t.doneConfirmed(
                isSpectra ? (
                  <>
                    {spectraPayment ? t.donePaidAmount(spectraPayment.amount) : ''}
                    {spectraPayment ? t.doneStatusSp(spectraPayment.status) : ''}.
                  </>
                ) : (
                  <>
                    {asText(transaction?.Amount) ? t.donePaidAmount(asText(transaction?.Amount)) : ''}
                    {last4 ? t.doneCardEnding(last4) : ''}
                    {tranId ? t.doneTransaction(tranId) : ''}.
                  </>
                ),
              )}
            </p>
          </div>
          {!isSpectra && wantReceipt && receiptEmail ? (
            <div className="gw-result gw-result--ok">
              <p>{t.doneReceipt(receiptEmail.trim())}</p>
            </div>
          ) : null}
          <Bubble>{isSpectra ? t.doneRecapSp : t.doneRecap(integration)}</Bubble>
          {isSpectra && spectraCheckPreview ? (
            <TechCorner title={t.techTitleCheckSp}>
              <p>{t.techCheckIntroSp}</p>
              <JsonBlock value={spectraCheckPreview} />
              <p>{t.techCheckContrastSp}</p>
            </TechCorner>
          ) : null}
          {!isSpectra && result ? (
            <TechCorner title={t.techTitleCheck}>
              <p>{t.techCheckIntro}</p>
              {resultPreview ? <JsonBlock value={resultPreview} /> : null}
              <p>{t.techTicketVsAttempt}</p>
            </TechCorner>
          ) : null}
          <div className="gw-actions">
            <button type="button" className="cta-button" onClick={runAgainFromDone}>
              {t.runAgain}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
