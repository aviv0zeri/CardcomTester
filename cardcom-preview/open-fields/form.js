
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
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.getElementById('brandLogo').src = dark ? brand.logoDark : brand.logo;
        document.getElementById('brandName').textContent = brand.name;
        document.getElementById('brand').hidden = false;
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
        const cardCssText = await cardCSSPromise.text();

        //2.In template element
        const template = document.getElementById('css_template').content.querySelector('style')

        //3.Store your CSS in a string variable 
        const inlineCSS = `body {
                            margin: 0;
                            padding:0;
                            display: flex;
                        }`

        //Note: props names are important
        iframeMessage = {
            action: 'init',
            cardFieldCSS: cardCssText,
            cvvFieldCSS: template.innerText.toString(),
            reCaptchaFieldCSS: inlineCSS,
            placeholder: "1111-2222-3333-4444",
            cvvPlaceholder: "123",
            lowProfileCode: lowProfileCode,
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
                // there, not something to alert the user about.
                if (!isPreview) alert(msg.message)
                break;
            case "handleValidations":
                if (msg.field === "cvv");
                    setCvvFieldClass(msg.isValid);
                if (msg.field === "cardNumber");
                    setCardNumberClass(msg.isValid);
                if (msg.field === "reCaptcha") {
                    //if you want to enable the "pay" button after all iframe fields have beed validated
                }
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
            alert(data.Description);
        else
            alert("Deal failed");
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

function submitForm(e) {
    const loading = document.getElementById('loading')
    const iframe = document.querySelector('#CardComMasterFrame')
    e.preventDefault()
    //Add your loading gif and start it here
    loading.style.display = 'flex'

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
