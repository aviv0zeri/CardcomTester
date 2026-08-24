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
    successRedirectUrl:
      process.env.CARDCOM_SUCCESS_URL || 'http://localhost:5173/success',
    failedRedirectUrl:
      process.env.CARDCOM_FAILED_URL || 'http://localhost:5173/failed',
    operation: 'ChargeOnly',
    // Optional HTTPS stylesheet. Production branding belongs in Cardcom's CSS editor;
    // omit CSSUrl (leave CARDCOM_CSS_URL empty) once checkout.css is pasted there.
    // Localhost CSS is blocked as mixed content on Cardcom's HTTPS page.
    cssUrl:
      process.env.CARDCOM_CSS_URL ||
      'https://cdn.statically.io/gist/aviv0zeri/52ddff9d6c3423bab3703cfd33dc86fe/raw/cardcom-stack-v16.css',
    googlePayBtnDesign: {
      ButtonWidth: '100%',
      ButtonHeight: '40',
    },
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

function buildLowProfileBody(profile, amount) {
  const uiDefinition = {};

  if (profile.cssUrl) {
    uiDefinition.CSSUrl = profile.cssUrl;
  }

  if (profile.googlePayBtnDesign) {
    uiDefinition.GooglePayBtnDesign = profile.googlePayBtnDesign;
  }

  const body = {
    TerminalNumber: profile.terminalNumber,
    ApiName: profile.apiName,
    Amount: amount,
    Operation: profile.operation || 'ChargeOnly',
    SuccessRedirectUrl: profile.successRedirectUrl,
    FailedRedirectUrl: profile.failedRedirectUrl,
  };

  if (Object.keys(uiDefinition).length > 0) {
    body.UIDefinition = uiDefinition;
  }

  return body;
}

module.exports = {
  getProfile,
  buildLowProfileBody,
};
