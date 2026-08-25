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
    language: 'he',
    successRedirectUrl:
      process.env.CARDCOM_SUCCESS_URL || 'https://www.google.com',
    failedRedirectUrl:
      process.env.CARDCOM_FAILED_URL || 'https://www.yahoo.com',
    operation: 'ChargeOnly',
    // Optional HTTPS stylesheet. Production branding belongs in Cardcom's CSS editor.
    // Localhost CSS is blocked as mixed content on Cardcom's HTTPS page.
    cssUrl: process.env.CARDCOM_CSS_URL || '',
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
    Language: profile.language || 'he',
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
