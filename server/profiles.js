/**
 * Payment profiles live on the API.
 * They select Cardcom account, terminal, redirects, operation, and optional CSSUrl.
 * Wallet / method visibility is Cardcom terminal, template, or Low Profile config —
 * not something this process toggles inside the hosted page.
 */

const profiles = {
  tester: {
    terminalNumber: Number(process.env.CARDCOM_TERMINAL),
    apiName: process.env.CARDCOM_USERNAME,
    apiPassword: process.env.CARDCOM_PASSWORD,
    // Diagnostic pages only — display whatever Cardcom put on the redirect,
    // change no billing state. Cardcom's own docs say this redirect is not
    // authoritative; GetLpResult / their server-to-server reporting is.
    // Always the production URL: Cardcom redirects the customer's own
    // browser here, which needs a real internet-reachable HTTPS address
    // regardless of whether local dev is running.
    successRedirectUrl:
      process.env.CARDCOM_SUCCESS_URL || 'https://cardcom-tester.vercel.app/diagnostics/success.html',
    failedRedirectUrl:
      process.env.CARDCOM_FAILED_URL || 'https://cardcom-tester.vercel.app/diagnostics/failure.html',
    operation: 'ChargeOnly',
    // Optional HTTPS stylesheet. Production branding belongs in Cardcom's CSS editor.
    // Localhost CSS is blocked as mixed content on Cardcom's HTTPS page.
    cssUrl: process.env.CARDCOM_CSS_URL || '',
    // Cardcom UIDefinition.GooglePayBtnDesign — documented GPay face (not CSS internals).
    googlePayBtnDesign: {
      ButtonColor: 0,
      ButtonType: 0,
      ButtonWidth: '100%',
      ButtonHeight: '40',
    },
    // Documented UIDefinition field (API 11 Swagger) — the real way to drop
    // the email field. Phone stays visible: Cardcom's own docs say 3DS only
    // fails if BOTH phone and email are hidden. Preferred over the CSS-only
    // hide in brand-skin.css, since this stops Cardcom's own validation from
    // expecting a value there too (a CSS hide alone can't guarantee that).
    hideCardOwnerEmail: true,
  },
};

function getProfile(profileId) {
  const id = profileId || 'tester';
  const profile = profiles[id];

  if (!profile) {
    const error = new Error(`Unknown payment profile: ${id}`);
    error.statusCode = 400;
    throw error;
  }

  return { id, ...profile };
}

const LANGUAGES = ['he', 'en', 'ru', 'ar'];

function buildLowProfileBody(profile, amount, language) {
  if (!LANGUAGES.includes(language)) {
    const error = new Error('language must be he, en, ru, or ar');
    error.statusCode = 400;
    throw error;
  }

  const uiDefinition = {};

  if (profile.cssUrl) {
    uiDefinition.CSSUrl = profile.cssUrl;
  }

  if (profile.googlePayBtnDesign) {
    uiDefinition.GooglePayBtnDesign = profile.googlePayBtnDesign;
  }

  if (profile.hideCardOwnerEmail) {
    uiDefinition.IsHideCardOwnerEmail = true;
  }

  const body = {
    TerminalNumber: profile.terminalNumber,
    ApiName: profile.apiName,
    Amount: amount,
    Language: language,
    Operation: profile.operation || 'ChargeOnly',
    SuccessRedirectUrl: profile.successRedirectUrl,
    FailedRedirectUrl: profile.failedRedirectUrl,
  };

  if (profile.apiPassword) {
    body.ApiPassword = profile.apiPassword;
  }

  if (Object.keys(uiDefinition).length > 0) {
    body.UIDefinition = uiDefinition;
  }

  return body;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function parseProducts(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => ({
      Description: String(row.description || row.Description || '').trim(),
      Quantity: Number(row.quantity ?? row.Quantity),
      UnitCost: Number(row.unitCost ?? row.UnitCost),
    }))
    .filter(
      (row) =>
        row.Description &&
        Number.isFinite(row.Quantity) &&
        row.Quantity > 0 &&
        Number.isFinite(row.UnitCost) &&
        row.UnitCost >= 0,
    )
}

function productTotal(products) {
  return roundMoney(
    products.reduce((sum, row) => sum + row.Quantity * row.UnitCost, 0),
  )
}

function assignIfPresent(target, key, value) {
  if (value === undefined || value === null) return
  const text = String(value).trim()
  if (!text) return
  target[key] = text
}

function buildLabCreateBody(profile, input) {
  const source = input && typeof input === 'object' ? input : {}
  const products = parseProducts(source.products)
  const includeDocument = Boolean(source.includeDocument) || products.length > 0
  let amount = Number(source.amount)
  if (includeDocument && products.length) {
    amount = productTotal(products)
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error('amount must be a number greater than 0')
    error.statusCode = 400
    throw error
  }

  const body = buildLowProfileBody(profile, amount, source.language)
  if (source.returnValue) {
    body.ReturnValue = String(source.returnValue).slice(0, 250)
  }

  if (includeDocument) {
    const document = {
      DocumentTypeToCreate: source.documentType || 'TaxInvoiceAndReceipt',
    }
    if (products.length) document.Products = products

    const customer = source.customer && typeof source.customer === 'object' ? source.customer : {}
    assignIfPresent(document, 'Name', customer.name || customer.Name)
    assignIfPresent(document, 'TaxId', customer.taxId || customer.TaxId)
    assignIfPresent(document, 'Email', customer.email || customer.Email)
    assignIfPresent(document, 'AddressLine1', customer.addressLine1 || customer.AddressLine1)
    assignIfPresent(document, 'City', customer.city || customer.City)
    assignIfPresent(document, 'Mobile', customer.mobile || customer.Mobile)
    if (typeof customer.isSendByEmail === 'boolean') {
      document.IsSendByEmail = customer.isSendByEmail
    } else if (typeof customer.IsSendByEmail === 'boolean') {
      document.IsSendByEmail = customer.IsSendByEmail
    }
    body.Document = document
  }

  return { body, amount, includeDocument }
}

function buildLabResultBody(profile, lowProfileId) {
  const id = String(lowProfileId || '').trim()
  if (!id) {
    const error = new Error('LowProfileId is required')
    error.statusCode = 400
    throw error
  }
  const body = {
    TerminalNumber: profile.terminalNumber,
    ApiName: profile.apiName,
    LowProfileId: id,
  }
  if (profile.apiPassword) body.ApiPassword = profile.apiPassword
  return body
}

module.exports = {
  LANGUAGES,
  getProfile,
  buildLowProfileBody,
  buildLabCreateBody,
  buildLabResultBody,
  productTotal,
  parseProducts,
};
