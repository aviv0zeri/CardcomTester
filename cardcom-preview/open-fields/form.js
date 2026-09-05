// Presentation knobs the tester passes on the query string. Applied while
// this script runs in <head>, so the first paint is already themed.
const PAGE_PARAMS = new URLSearchParams(location.search);

// ?theme=dark|light forces a theme through data-theme (form.css pairs every
// dark token block with both guards); anything else follows the OS.
const FORCED_THEME = ['dark', 'light'].includes(PAGE_PARAMS.get('theme')) ? PAGE_PARAMS.get('theme') : null;
if (FORCED_THEME) document.documentElement.dataset.theme = FORCED_THEME;

function isDarkTheme() {
    return FORCED_THEME ? FORCED_THEME === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// ?accent=rrggbb (strict six-hex, nothing else) recolours the page's accent.
// The hover shade and soft tint are derived from it, so one value is enough.
const ACCENT = /^#?([0-9a-f]{6})$/i.exec(PAGE_PARAMS.get('accent') || '');
if (ACCENT) applyAccent('#' + ACCENT[1].toLowerCase());

function applyAccent(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    // Hover shade goes darker on light and lighter on dark, like the stock tokens.
    const towards = isDarkTheme() ? 255 : 0;
    const amount = isDarkTheme() ? 0.3 : 0.5;
    const strong = [r, g, b].map((c) => Math.round(c + (towards - c) * amount));
    const root = document.documentElement.style;
    root.setProperty('--accent', hex);
    root.setProperty('--accent-strong', '#' + strong.map((c) => c.toString(16).padStart(2, '0')).join(''));
    root.setProperty('--accent-soft-bg', `rgba(${r}, ${g}, ${b}, 0.18)`);
}

// Google Pay button design. Cardcom's master frame reads `googlePayButton`
// off our init message (its OpenFields.js: state.googlePayButtonConfig =
// data.googlePayButton) and forwards it to the wallet iframe's createButton,
// so these are Google's own ButtonOptions.
//   type: 'pay' ("Pay with G Pay") -- matches the page's own "Pay now" and,
//   unlike Google's default 'buy', never takes the Chrome-only dynamic
//   card-info rendering that draws a second outlined frame around the pill.
//   colour: black on BOTH themes. Google's guidance is white on dark
//   backgrounds, but with the pay.js Cardcom bundles today buttonColor
//   'white' paints Google's current (black) pill asset over a white square,
//   which looks broken -- verified live, so white stays off until Cardcom's
//   bundle catches up.
// ?gpay=<buttonType> and ?gpaycolor=black|white let the tester compare
// Google's variants; only documented values pass.
const GPAY_BUTTON_TYPES = ['buy', 'pay', 'plain', 'checkout', 'order', 'book', 'donate', 'subscribe'];
const GPAY_BUTTON_LOCALES = ['en', 'ar', 'bg', 'ca', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hr', 'id', 'it',
    'ja', 'ko', 'ms', 'nl', 'no', 'pl', 'pt', 'ru', 'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'uk', 'zh'];

function googlePayButtonConfig() {
    const config = {
        buttonColor: 'black',
        buttonType: 'pay',
        buttonSizeMode: 'fill',
    };
    const type = PAGE_PARAMS.get('gpay');
    if (GPAY_BUTTON_TYPES.includes(type)) config.buttonType = type;
    const colour = PAGE_PARAMS.get('gpaycolor');
    if (colour === 'black' || colour === 'white') config.buttonColor = colour;
    // Button text follows the page language where Google ships that
    // language. Hebrew is not in Google's list (en, ar, bg, ca, cs, da, de,
    // el, es, et, fi, fr, hr, id, it, ja, ko, ms, nl, no, pl, pt, ru, sk,
    // sl, sr, sv, th, tr, uk, zh), so a Hebrew page gets Google's fallback
    // (browser language, else English) rather than a made-up locale.
    const lang = PAGE_PARAMS.get('lang');
    if (GPAY_BUTTON_LOCALES.includes(lang)) config.buttonLocale = lang;
    return config;
}

// Which billing template to show: us (Cardcom's original example), il, or eu.
function currentRegion() {
    const region = new URLSearchParams(location.search).get('region');
    return region === 'il' || region === 'eu' ? region : 'us';
}

function fieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

// Hebrew labels for the Israel template (applied only when region=il and
// lang=he -- the us/eu templates stay English).
const HEBREW_LABELS = {
    il_details: 'פרטים אישיים',
    il_full_name: 'שם מלא',
    il_id: 'תעודת זהות',
    il_phone: 'טלפון',
    il_email: 'אימייל',
    il_invoice_toggle: 'אני רוצה חשבונית / קבלה',
    il_invoice_name: 'שם לחשבונית',
    il_invoice_email: 'אימייל לחשבונית',
    payment_title: 'תשלום',
    accepted_cards: 'כרטיסים נתמכים',
    card_number: 'מספר כרטיס אשראי',
    exp_month: 'חודש',
    exp_year: 'שנה',
    submit: 'בצע תשלום',
    secure_payment: 'תשלום מאובטח',
    test_fill: 'מלא פרטי בדיקה',
    pay_failed: 'התשלום נכשל',
    pay_done: 'התשלום הושלם',
    cvv_hint: '3 הספרות שבגב הכרטיס',
    card_required: 'נא להזין מספר כרטיס תקין',
    cvv_required: 'נא להזין CVV תקין',
    card_cvv_required: 'נא להזין מספר כרטיס ו-CVV תקינים',
    fill_hint: 'הפרטים מולאו. עכשיו הקלידו את כרטיס הבדיקה בשדות הכרטיס (שדות מאובטחים של קארדקום שלא ניתן למלא מכאן): 4580 2800 0000 0008 · 12/30 · כל CVV',
};

// Hebrew UI = the Israel template in anything but English (the us/eu
// templates stay English) -- the same rule the label pass below uses.
const IS_HEBREW = currentRegion() === 'il' && PAGE_PARAMS.get('lang') !== 'en';
const label = (key, fallback) => (IS_HEBREW && HEBREW_LABELS[key]) || fallback;

// Payment outcome, inline under the Pay button. Cardcom's original example
// used alert() here, which embedded browsers and some iframe hosts swallow
// -- so a failed attempt looked like "nothing happened".
function showPayStatus(text, kind) {
    const status = document.getElementById('payStatus');
    status.textContent = text;
    status.className = `pay-status is-${kind}`;
    status.hidden = false;
}

// Cardcom sends `message` as a string or an array of strings.
function errorText(message, fallback) {
    const text = Array.isArray(message) ? message.filter(Boolean).join(' ') : message;
    return text || fallback;
}

// Card-field check before a transaction: Cardcom's card-number/CVV frames
// answer validateCardNumber/validateCvv with handleValidations messages
// (relayed by the master frame, the same ones they send on blur). The
// recorder resolves the pending check once both fields have answered; no
// answer within the timeout resolves null so a slow frame never blocks a
// payment -- the server still validates.
let cardValidation = null;

function recordValidation(field, isValid) {
    if (!cardValidation) return;
    cardValidation.results[field] = isValid;
    if ('cardNumber' in cardValidation.results && 'cvv' in cardValidation.results) {
        cardValidation.resolve(cardValidation.results);
    }
}

function validateCardFields() {
    const master = document.querySelector('#CardComMasterFrame');
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 1500);
        cardValidation = { results: {}, resolve: (results) => { clearTimeout(timer); resolve(results); } };
        master.contentWindow.postMessage({ action: 'validateCardNumber' }, '*');
        master.contentWindow.postMessage({ action: 'validateCvv' }, '*');
    }).finally(() => { cardValidation = null; });
}

// Cardcom's frames only report valid/invalid (an empty box and a mistyped
// number look the same to us), so the wording covers both.
function missingCardFieldsText(results) {
    const card = results.cardNumber === false;
    const cvv = results.cvv === false;
    if (card && cvv) return label('card_cvv_required', 'Please enter a valid card number and CVV');
    if (card) return label('card_required', 'Please enter a valid card number');
    if (cvv) return label('cvv_required', 'Please enter a valid CVV');
    return '';
}

// Test details per billing template, keyed by field id -- the same values
// the placeholders show (the invoice fields too, for when that box is
// ticked). Card number and CVV are Cardcom's iframes and are deliberately
// not fillable from this page.
const TEST_DETAILS = {
    il: {
        ilFullName: 'ישראל ישראלי', ilIdNumber: '000000000', ilPhone: '0501234567', ilEmail: 'israel@example.com',
        ilInvoiceName: 'ישראל ישראלי', ilInvoiceEmail: 'israel@example.com',
    },
    us: {
        cname: 'John M. Doe', cardOwnerEmail: 'john@example.com', adr: '542 W. 15th Street',
        city: 'New York', state: 'NY', zip: '10001', cardOwnerName: 'John More Doe',
    },
    eu: {
        euFullName: 'Anna Schmidt', euEmail: 'anna@example.com', euAddress: 'Hauptstraße 12',
        euCity: 'Berlin', euPostal: '10115', euCountry: 'Germany', cardOwnerName: 'Anna Schmidt',
    },
};

document.addEventListener("DOMContentLoaded", () => {
    var lowProfileCode = undefined;
    const firstSceen = document.getElementById('first-screen');
    const secondSceen = document.getElementById('second-screen');
    const iframe = document.querySelector('#CardComMasterFrame');
    const loading = document.getElementById('loading');
    // The init postMessage is lost if it goes out before the master frame
    // has loaded -- which is exactly what happens with screen=checkout,
    // where the checkout is shown at DOMContentLoaded rather than on a
    // later click. Capped so an already-fired load can't stall the page.
    const masterLoaded = new Promise((resolve) => {
        iframe.addEventListener('load', resolve, { once: true });
        setTimeout(resolve, 3000);
    });

    var iframeMessage = {};
    const isPreview = new URLSearchParams(location.search).get('preview') === '1';
    // embed=1: the page sits inside the tester's sized iframe -- tight
    // padding and short credits so it fits without scrolling (form.css).
    const isEmbed = new URLSearchParams(location.search).get('embed') === '1';
    if (isEmbed) document.documentElement.classList.add('embed');
    document.getElementById('continue').addEventListener('click', nextScreen);

    const region = currentRegion();
    document.querySelectorAll('[data-billing]').forEach((block) => {
        block.style.display = block.id === `billing-${region}` ? '' : 'none';
    });
    if (region === 'il') {
        // Israel collects one name (like the Low Profile checkout), so the
        // payment column's separate "Name on Card" is redundant there.
        document.getElementById('nameOnCardRow').style.display = 'none';
        const toggle = document.getElementById('ilInvoiceToggle');
        toggle.addEventListener('change', () => {
            document.getElementById('il-invoice-fields').style.display = toggle.checked ? '' : 'none';
        });
        if (new URLSearchParams(location.search).get('lang') !== 'en') {
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'he';
            document.querySelectorAll('[data-i18n]').forEach((el) => {
                const text = HEBREW_LABELS[el.getAttribute('data-i18n')];
                if (text) el.textContent = text;
            });
            // Tooltip/aria text lives in attributes, not text content.
            document.querySelectorAll('[data-i18n-tip]').forEach((el) => {
                const text = HEBREW_LABELS[el.getAttribute('data-i18n-tip')];
                if (text) {
                    el.setAttribute('data-tip', text);
                    el.setAttribute('aria-label', text);
                }
            });
            const submit = document.querySelector('[data-i18n-value="submit"]');
            if (submit) submit.value = HEBREW_LABELS.submit;
        }
    }

    // Credits iframe supports en/he only (per Cardcom's own comment in the
    // HTML). Always the short variant, kept small at the footer's right;
    // the default src is Hebrew, so only English needs a swap.
    if (new URLSearchParams(location.search).get('lang') === 'en') {
        const credits = document.getElementById('CardcomCredits');
        credits.src = 'https://secure.cardcom.solutions/api/openfields/credits?language=en&type=short';
    }

    // Brand header: which business this checkout belongs to. Allowlisted ids
    // only -- never a name or image URL taken from the query string. The
    // tester's business profiles (profiles.ts) use these same ids.
    const BRANDS = {
        gateopen: {
            name: 'GateOpen',
            // server/profiles.js key -> that business's Cardcom terminal.
            profileId: 'gateopen',
            logo: '/cardcom-preview/brand/gateopen-light.svg',
            logoDark: '/cardcom-preview/brand/gateopen-dark.svg',
        },
    };
    const brand = BRANDS[new URLSearchParams(location.search).get('brand')];
    if (brand) {
        document.getElementById('brandLogo').src = isDarkTheme() ? brand.logoDark : brand.logo;
        document.getElementById('brandName').textContent = brand.name;
        document.getElementById('brand').hidden = false;
    }

    // Tester-only: ?wallets=<2-4> pads the wallet row with mock Apple Pay /
    // Bit / PayPal buttons after the real Google Pay, to preview how the
    // flex-wrap layout spreads several wallets. Pure CSS look-alikes -- not
    // wired to anything (Cardcom Open Fields here only provides Google Pay).
    const walletCount = Math.min(4, Math.max(1, Number(PAGE_PARAMS.get('wallets')) || 1));
    if (walletCount > 1) {
        const row = document.getElementById('walletRow');
        ['applepay', 'bit', 'paypal'].slice(0, walletCount - 1).forEach((kind) => {
            const item = document.createElement('div');
            item.className = 'wallet-item';
            const mock = document.createElement('button');
            mock.type = 'button';
            mock.className = `wallet-mock wallet-mock--${kind}`;
            mock.setAttribute('aria-label', `${kind} (mock)`);
            mock.title = 'Mock button (layout preview only)';
            item.appendChild(mock);
            row.appendChild(item);
        });
    }

    // Tester-only: ?testfill=1 shows the "Fill test details" button (in the
    // brand header, so it needs a brand too). It fills this page's own
    // fields for the current template and hands the card-owner details to
    // Cardcom's master frame, exactly as blurring those fields would.
    if (PAGE_PARAMS.get('testfill') === '1') {
        const fill = document.getElementById('testFill');
        fill.hidden = false;
        fill.addEventListener('click', () => {
            const values = TEST_DETAILS[region] || {};
            Object.keys(values).forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = values[id];
            });
            setCardOwnerDetails();
            // The card itself has to be typed: card number and CVV are
            // Cardcom's secure iframes, which accept no value from this page.
            showPayStatus(label('fill_hint', "Details filled. Now type the test card in the card boxes -- they are Cardcom's secure fields and can't be filled from here: 4580 2800 0000 0008 · 12/30 · any CVV"), 'info');
        });
    }

    // screen=checkout: skip the page's own cart screen -- the tester's
    // two-panel view shows its own order summary in that role.
    if (new URLSearchParams(location.search).get('screen') === 'checkout') nextScreen();

    function showNotice(text) {
        const notice = document.getElementById('notice');
        notice.textContent = text;
        notice.hidden = false;
    }

    async function showFields() {
        firstSceen.style.display = 'none';
        secondSceen.style.display = 'block';
        // Google Pay needs a real session; without one its frame is a blank box.
        if (isPreview) document.getElementById('walletRow').style.display = 'none';
        await loadIframesCss();
        window.addEventListener("message", handleFrameMessages);
        handleFormSubmit();
    }

    function nextScreen(event) {
        if (event) event.preventDefault();
        const params = new URLSearchParams(location.search);
        const language = params.get('lang') || 'he';

        // Preview mode: never touch the API. Cardcom's card/CVV iframes
        // render fine without a session (they only validate lowProfileCode
        // at doTransaction time), so the layout is fully viewable.
        if (isPreview) {
            showNotice('Preview — no Cardcom session was created; Pay will not charge.');
            showFields();
            return;
        }

        // A session created elsewhere (the API lab's Create step) -- use it
        // instead of creating our own.
        const providedLpid = params.get('lpid');
        if (providedLpid) {
            lowProfileCode = providedLpid;
            console.log("lowProfileCode (from lpid param)", lowProfileCode);
            showFields();
            return;
        }

        //create a low profile deal -- CardcomTester's own /payment route (same
        //LowProfile/Create call every other tab in this app uses), not the
        //standalone example backend this file originally shipped with. The
        //business's own terminal (its brand's profileId) takes the session.
        fetch('/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: brand ? brand.profileId : 'gateopen', amount: 3, language }),
        }).then(async res => {
            const json = await res.json();
            lowProfileCode = json.LowProfileId
            console.log("lowProfileCode", lowProfileCode);

            if (!lowProfileCode) {
                console.warn(`No LowProfileId (ResponseCode ${json.ResponseCode}: ${json.Description || 'unknown error'}) -- fields below are real, but Submit Payment will fail.`);
                showNotice(`Preview only: ${json.Description || 'could not create a session'} (${json.ResponseCode}). The card/CVV fields below are real Cardcom iframes; Submit Payment won't work until this clears.`);
            }

            await showFields();
        })
            .catch(err => {
                console.error(err);
                loading.style.display = 'none';
                alert('Could not create LP deal ', err);
            })
    }

    async function loadIframesCss() {
        /*
            You have several ways to fetch your CSS to be sent to CardCom iframe: regular *.css file, template element or plain text
            Eventually you need to send a string that represents valid CSS rules
        */

        // 1.Fetching CSS from files
        const cardCSSPromise = await fetch('styles/cardNumber.css');

        //2.In template element
        const template = document.getElementById('css_template').content.querySelector('style')

        //3.Store your CSS in a string variable
        const inlineCSS = `body {
                            margin: 0;
                            padding:0;
                            display: flex;
                        }`

        // Cardcom's card-number/CVV boxes are separate documents, so the
        // page theme can't reach them through CSS. Their colours are read
        // off our resolved tokens (theme and accent already applied) and
        // appended as overrides to the CSS text we send them.
        const tokens = getComputedStyle(document.documentElement);
        const tok = (name) => tokens.getPropertyValue(name).trim();
        // Same geometry and states as this page's own inputs: a 41px
        // border-box with 3px of room on every side (the iframe is 47px and
        // pulled back 3px in form.css), so the focus ring / red border have
        // somewhere to draw instead of being clipped by the frame edge.
        const themedField = `box-sizing: border-box; height: 41px; margin: 3px; width: calc(100% - 6px); border-color: ${tok('--border-strong')}; color: ${tok('--text')}; background: ${tok('--surface')};`;
        const focusField = `outline: none; border-color: ${tok('--accent')}; box-shadow: 0 0 0 3px ${tok('--accent-soft-bg')};`;
        const invalidField = `border-color: ${tok('--danger')};`;
        // A transparent document background keeps the room around the box
        // from showing as a light seam on the dark theme.
        const themedDoc = 'html, body { background: transparent; }';
        // cardNumber.css has no invalid state of its own (the CVV template
        // does); its card-brand icon is positioned off the body, so it moves
        // with the box's 3px margin.
        const cardCssText = `${await cardCSSPromise.text()}\n${themedDoc}\n#cardNumber { ${themedField} }\n#cardNumber:focus { ${focusField} }\n#cardNumber.invalid { ${invalidField} }\n.credit-card { left: 13px; top: 12px; }`;
        const cvvCssText = `${template.innerText.toString()}\n${themedDoc}\n.cvvField { ${themedField} }\n.cvvField:focus { ${focusField} }\n.cvvField.invalid { ${invalidField} }`;

        //Note: props names are important
        iframeMessage = {
            action: 'init',
            cardFieldCSS: cardCssText,
            cvvFieldCSS: cvvCssText,
            reCaptchaFieldCSS: inlineCSS,
            placeholder: "1111-2222-3333-4444",
            cvvPlaceholder: "123",
            lowProfileCode: lowProfileCode,
            googlePayButton: googlePayButtonConfig(),
            //language: "he"
        }

        await masterLoaded;
        iframe.contentWindow.postMessage(iframeMessage, '*');

    }

    function handleFrameMessages(message) {
        //add validations here that the message came from secure.cardcom.solutions
        const msg = message.data

        switch (msg.action) {
            case "HandleSubmit":
                //redirect to your succssess page here
                console.log("HandleSubmit", msg);
                handleSubmitResult(msg.data);
                break
            case "HandleEror":
                //redirect to your error page / display error popup here
                loading.style.display = 'none';
                console.log("HandleEror", msg);
                // Preview has no lowProfileCode on purpose -- the master
                // frame's "required parameter" complaint is expected noise
                // there, not something to show the user.
                if (!isPreview) showPayStatus(errorText(msg.message, label('pay_failed', 'Payment failed')), 'error');
                break;
            case "handleValidations":
                // (Cardcom's example had a stray ';' after each if, which ran
                // both setters for every field -- one field's result marked
                // the other box too.)
                if (msg.field === "cvv") setCvvFieldClass(msg.isValid);
                if (msg.field === "cardNumber") setCardNumberClass(msg.isValid);
                recordValidation(msg.field, msg.isValid);
                if (msg.field === "reCaptcha") {
                    //if you want to enable the "pay" button after all iframe fields have beed validated
                }
                break;
            default:
                break;
        }
    }

    function setCvvFieldClass(isValid) {
        if (!isValid) {
            iframe.contentWindow.postMessage({
                action: 'addCvvFieldClass',
                className: "invalid"
            }, '*');
        }
        else {
            iframe.contentWindow.postMessage({
                action: 'removeCvvFieldClass',
                className: "invalid"
            }, '*');
        }
    }

    function setCardNumberClass(isValid) {
        if (isValid)
            iframe.contentWindow.postMessage({ action: 'removeCardNumberFieldClass', className: "invalid" }, '*');
        else
            iframe.contentWindow.postMessage({ action: 'addCardNumberFieldClass', className: "invalid" }, '*');
    }

    function handleSubmitResult(data) {
        loading.style.display = 'none'
        if (data.IsSuccess)
            showPayStatus(data.Description || label('pay_done', 'Payment completed'), 'success');
        else
            showPayStatus(errorText(data.Description, label('pay_failed', 'Payment failed')), 'error');
    }

    function handleFormSubmit() {
        const form = document.getElementById('form')
        form.addEventListener("submit", (e) => {
            submitForm(e);
        })
    }
})

// Card holder details per billing template. Israel is the only region with
// its own name/phone/ID fields -- the others use the payment column's
// "Name on Card" and the example's stand-in phone.
function cardOwnerDetails() {
    const region = currentRegion();
    if (region === 'il') {
        return {
            cardOwnerName: fieldValue('ilFullName'),
            cardOwnerEmail: fieldValue('ilEmail'),
            cardOwnerPhone: fieldValue('ilPhone') || '054512345678',
            //sending zeros to pass luhn algorithm check. If your terminal requires a valid card owner id, please provide it here.
            cardOwnerId: fieldValue('ilIdNumber') || '000000000',
        };
    }
    return {
        cardOwnerName: fieldValue('cardOwnerName'),
        cardOwnerEmail: region === 'eu' ? fieldValue('euEmail') : fieldValue('cardOwnerEmail'),
        cardOwnerPhone: '054512345678',
        cardOwnerId: '000000000',
    };
}

//this method allows to update the card holder details info to be used in Google Pay transactions
//
function setCardOwnerDetails(e) {

    //update card holder details: name, email and phone
    const { cardOwnerName, cardOwnerEmail, cardOwnerPhone } = cardOwnerDetails();
    const data = { cardOwnerName, cardOwnerEmail, cardOwnerPhone };
    const iframe = document.querySelector('#CardComMasterFrame')
    iframe.contentWindow.postMessage({ action: 'setCardOwnerDetails', data }, '*')
}

// Invoice document, built from the Israel template's invoice fields. Only
// sent when the invoice checkbox is checked -- unlike Cardcom's original
// example, no sample Receipt is attached to every charge (its fake 9.99
// product line wouldn't match the session's real amount anyway).
function buildInvoiceDocument() {
    const amount = Number(new URLSearchParams(location.search).get('amount')) || 3;
    const email = fieldValue('ilInvoiceEmail') || fieldValue('ilEmail');
    return {
        Name: fieldValue('ilInvoiceName') || fieldValue('ilFullName') || 'Test',
        Email: email,
        // Actually deliver the receipt when there's an address to send it to.
        IsSendByEmail: Boolean(email),
        Language: 'he',
        DocumentTypeToCreate: 'Receipt',
        Products: [{
            Description: 'Order',
            Quantity: 1,
            UnitCost: amount,
            TotalLineCost: amount,
        }],
    };
}

async function submitForm(e) {
    const loading = document.getElementById('loading')
    const iframe = document.querySelector('#CardComMasterFrame')
    e.preventDefault()
    //Add your loading gif and start it here
    loading.style.display = 'flex'
    const status = document.getElementById('payStatus');
    if (status) status.hidden = true;

    // An empty card otherwise travels to the server and comes back as a
    // generic "Charge failed" -- ask Cardcom's frames first and say which
    // box is missing. (No answer in time = go ahead; the server validates.)
    const validation = await validateCardFields();
    const missing = validation ? missingCardFieldsText(validation) : '';
    if (missing) {
        loading.style.display = 'none';
        showPayStatus(missing, 'error');
        return;
    }

    const invoiceToggle = document.getElementById('ilInvoiceToggle');
    const wantsInvoice = currentRegion() === 'il' && invoiceToggle && invoiceToggle.checked;

    //Note: if you are using 3DS, it is now required to provide either the cardOwnerPhone or the cardOwnerEmail
    const formProps = {
        action: 'doTransaction',
        ...cardOwnerDetails(),
        expirationMonth: document.getElementById('expirationMonth').value,
        expirationYear: document.getElementById('expirationYear').value,
        ...(wantsInvoice ? { document: buildInvoiceDocument() } : {}),
        numberOfPayments: "1",
    }

    iframe.contentWindow.postMessage({
        ...formProps
    }, '*');

}


//this is an example of Document object as in https://secure.cardcom.solutions/swagger/index.html?url=/swagger/v11/swagger.json#tag/LowProfile/operation/LowProfile_Create
//Used for creating documents (invoice, etc)
//Kept as schema reference only -- no longer sent with every transaction
//(see buildInvoiceDocument above for what actually goes out).
function createDocument() {
    return {
        Name: "Cardcom",
        Email: "support@cardcom.solutions.co.il",
        IsSendByEmail: false,
        AddressLine1: "Harokmin 26",
        AddressLine2: "Azrieli Center",
        City: "Holon",
        Mobile: "054123465789",
        Phone: "03-9436100",
        Comments: "Your comments",
        IsVatFree: false,
        DepartmentId: 123,
        ExternalId: "external-id",
        IsAllowEditDocument: false,
        IsShowOnlyDocument: false,
        Language: "he",
        DocumentTypeToCreate: "Receipt", //see swagger for full list
        AdvancedDocumentDefinition: {
            IsAutoCreateUpdateAccount: "auto", //"true", "false", "auto"
            AccountForeignKey: "key",
            SiteUniqueId: "",
            AccountID: 1,
            IsLoadInfoFromAccountID: false
        },
        Products: [{
            ProductID: "ui-321",
            Description: "Description",
            Quantity: 1,
            UnitCost: 9.99,
            TotalLineCost: 9.99,
            IsVatFree: false
        }]
    }
}

/*
Those methods allow to validate the fields in the iframes, you can invoke them from your form validation logic.
Meant to allow you to enable / disable the "pay" button in your form according to the fields validations.
The result will return under "handleValidations" message with the field name and the result.
Same behavior occurs on focus out event of those the fields.
*/
function validateCvv() {
    const iframe = document.querySelector('#CardComMasterFrame');
    iframe.contentWindow.postMessage({ action: "validateCvv" }, '*');
}

function validateCardNumber() {
    const iframe = document.querySelector('#CardComMasterFrame');
    iframe.contentWindow.postMessage({ action: "validateCardNumber" }, '*');
}
