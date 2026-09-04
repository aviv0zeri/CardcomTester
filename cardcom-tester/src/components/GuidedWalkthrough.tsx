import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Language } from './CheckoutControls'
import { PaymentOverlay } from './PaymentOverlay'
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
  type OpenFieldsRegion,
} from './previewVersions'

// One screen at a time, one action at a time. The whole point of this tab is
// that nothing scrolls and nothing competes for attention -- the full ApiLab
// stays next door for power use. The walkthrough speaks Hebrew or English
// (one toggle drives both the interface and the payment page), and each big
// step carries an optional "under the hood" corner that teaches the tech
// (HTTP, API, JSON, webhooks) using the REAL payloads from this very run.

type GuidedStep = 'intro' | 'pick' | 'setup' | 'create' | 'pay' | 'check' | 'done'
type Integration = 'lowprofile' | 'openfields'
type Lang = UiLang

const TEST_CARD_NUMBER = '4580 2800 0000 0008'
const TEST_CARD_RAW = '4580280000000008'

type Copy = {
  dots: [string, string, string, string, string]
  introBubble: ReactNode
  introGo: string
  pickBubble: ReactNode
  lpTitle: string
  lpShort: ReactNode
  ofTitle: string
  ofShort: ReactNode
  lpLong: ReactNode
  ofLong: ReactNode
  continueBtn: string
  backBtn: string
  amountLabel: string
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
}

const COPY: Record<Lang, Copy> = {
  en: {
    dots: ['Choose', 'Amount', 'Session', 'Pay', 'Verify'],
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
        Cardcom gives you two ways to take a payment. <strong>Pick one</strong> — you can
        always come back and try the other.
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
    amountLabel: 'Amount (₪)',
    setupBubble: (
      <>
        <strong>How much are we pretending to charge?</strong> In Cardcom's test world, any
        amount under ₪5000 succeeds. Want to practice a <em>failed</em> payment someday?
        Use 5000 or more.
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
  },
  he: {
    dots: ['בחירה', 'סכום', 'יצירה', 'תשלום', 'אימות'],
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
        לקארדקום יש שתי דרכים לקבל תשלום. <strong>בחרו אחת</strong> — תמיד אפשר לחזור
        ולנסות את השנייה.
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
    amountLabel: 'סכום (₪)',
    setupBubble: (
      <>
        <strong>כמה נעמיד פנים שאנחנו גובים?</strong> בעולם הבדיקות של קארדקום כל סכום
        מתחת ל-5000 ₪ מצליח. רוצים לתרגל מתישהו תשלום <em>שנכשל</em>? השתמשו ב-5000
        ומעלה.
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

type GuidedWalkthroughProps = {
  disabled?: boolean
  lang: Lang
}

export function GuidedWalkthrough({ disabled, lang }: GuidedWalkthroughProps) {
  const viewport = useViewport()
  const [step, setStep] = useState<GuidedStep>('intro')
  const [integration, setIntegration] = useState<Integration>('lowprofile')
  const [picked, setPicked] = useState<Integration | null>(null)
  const [region, setRegion] = useState<OpenFieldsRegion>('il')
  const [amount, setAmount] = useState('10')
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

  const t = COPY[lang]
  // One choice drives both the walkthrough interface AND the payment page.
  const language: Language = lang

  const lowProfileId = asText(session?.LowProfileId)
  const sessionCode = responseCode(session)
  const resultCode = responseCode(result)
  const isOpenFields = integration === 'openfields'
  const amountNumber = Number(amount) || 0
  const receiptReady = !wantReceipt || receiptEmail.includes('@')

  const payUrl = isOpenFields
    ? lowProfileId
      ? openFieldsUrl(language, { lpid: lowProfileId, region, amount: amountNumber })
      : ''
    : asText(session?.Url || session?.url)

  const goTo = (next: GuidedStep) => {
    setError('')
    setStep(next)
  }

  const clearRun = () => {
    setSession(null)
    setCreateSent(null)
    setResult(null)
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
    setPayOpened(false)
    try {
      const data = await createLabSession({
        language,
        // A receipt needs a Document with an Email on it -- the 'customer'
        // scenario is the existing lab path that builds exactly that.
        scenario: wantReceipt ? 'customer' : 'charge',
        amount,
        documentType: 'Receipt',
        returnValue: 'guided-run',
        products: [
          {
            ...newProduct(),
            description: lang === 'he' ? 'הזמנה' : 'Order',
            quantity: '1',
            unitCost: amount,
          },
        ],
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
      }
    } catch (cause) {
      setError(t.errServer(cause instanceof Error ? cause.message : ''))
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
  const overlaySize =
    viewport.device === 'mobile'
      ? {}
      : {
          width: Math.min(1000, viewport.width - 40),
          height: Math.min(940, viewport.height - 40),
        }

  const runCheck = async () => {
    if (busy || !lowProfileId) return
    setBusy(true)
    setError('')
    try {
      const data = await checkLabResult(lowProfileId)
      const cardcom = asRecord(data.cardcom)
      setResult(cardcom)
      if (responseCode(cardcom) === 0) goTo('done')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'GetLpResult failed')
    }
    setBusy(false)
  }

  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText(TEST_CARD_RAW)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard can be blocked -- the number is printed right there anyway.
    }
  }

  const dots: { id: GuidedStep; label: string }[] = [
    { id: 'pick', label: t.dots[0] },
    { id: 'setup', label: t.dots[1] },
    { id: 'create', label: t.dots[2] },
    { id: 'pay', label: t.dots[3] },
    { id: 'check', label: t.dots[4] },
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
            <button type="button" className="cta-button gw-pulse" disabled={disabled} onClick={() => goTo('pick')}>
              {t.introGo}
            </button>
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
          </div>
          {picked ? (
            // Keyed so switching picks replays the pop-in with the new text.
            <div className="gw-picked-reveal" key={picked}>
              <Bubble>{picked === 'lowprofile' ? t.lpLong : t.ofLong}</Bubble>
              <div className="gw-actions">
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
          <Bubble>{t.setupBubble}</Bubble>
          <div className="gw-form">
            <label className="gw-field">
              {t.amountLabel}
              <input
                value={amount}
                inputMode="decimal"
                disabled={disabled}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            {isOpenFields ? (
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
            <label className="gw-receipt-toggle">
              <input
                type="checkbox"
                checked={wantReceipt}
                disabled={disabled}
                onChange={(event) => setWantReceipt(event.target.checked)}
              />
              {t.receiptToggle}
            </label>
            {wantReceipt ? (
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
          </div>
          <div className="gw-actions">
            <button type="button" className="text-btn" onClick={() => goTo('pick')}>
              {t.backBtn}
            </button>
            <button
              type="button"
              className="cta-button gw-pulse"
              disabled={disabled || !(amountNumber > 0) || !receiptReady}
              onClick={() => goTo('create')}
            >
              {t.continueBtn}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'create' ? (
        <section className="gw-step" key="create">
          <ArtTicket />
          <Bubble>{t.createBubble(amountNumber)}</Bubble>
          {sessionCode === 0 ? (
            <div className="gw-result gw-result--ok">
              <SuccessCheck />
              <p>
                {t.createOk(
                  <code dir="ltr">
                    {lowProfileId.slice(0, 8)}…{lowProfileId.slice(-4)}
                  </code>,
                )}
              </p>
            </div>
          ) : null}
          {error ? <p className="gw-error">{error}</p> : null}
          {sessionCode === 0 ? (
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
            {sessionCode === 0 ? (
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
          <Bubble>{t.checkBubble(lowProfileId ? lowProfileId.slice(0, 8) : '')}</Bubble>
          {result && resultCode !== 0 ? (
            <p className="gw-error">
              {resultCode === 5119
                ? t.pending5119
                : friendlyCardcomError(resultCode, asText(result.Description))}
            </p>
          ) : null}
          {error ? <p className="gw-error">{error}</p> : null}
          {result ? (
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
              disabled={disabled || busy || !lowProfileId}
              onClick={() => void runCheck()}
            >
              {busy ? t.asking : result ? t.askAgain : t.askBtn}
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
                <>
                  {asText(transaction?.Amount) ? t.donePaidAmount(asText(transaction?.Amount)) : ''}
                  {last4 ? t.doneCardEnding(last4) : ''}
                  {tranId ? t.doneTransaction(tranId) : ''}.
                </>,
              )}
            </p>
          </div>
          {wantReceipt && receiptEmail ? (
            <div className="gw-result gw-result--ok">
              <p>{t.doneReceipt(receiptEmail.trim())}</p>
            </div>
          ) : null}
          <Bubble>{t.doneRecap(integration)}</Bubble>
          {result ? (
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
