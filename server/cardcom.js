const CREATE_URL = 'https://secure.cardcom.solutions/api/v11/LowProfile/Create'
const RESULT_URL = 'https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult'
const TRANSACTION_URL = 'https://secure.cardcom.solutions/api/v11/Transactions/Transaction'

// ApiPassword must never reach the browser — stripped here before the debug
// echo goes back to React. ApiName currently still leaks into that debug
// view, which is acceptable only because terminal 1000 is Cardcom's public
// test account. Strip ApiName here too (or gate the whole debug echo behind
// a non-production flag) before this profile ever points at a real account.
function publicPayload(body) {
  if (!body || typeof body !== 'object') return body
  const copy = { ...body }
  delete copy.ApiPassword
  return copy
}

// Cardcom's Create/GetLpResult responses carry card metadata and customer
// PII (name, email, phone, ID, transaction details) — never dump the full
// object to stdout, even in local dev. This is the only shape safe to log.
function responseSummary(data) {
  if (!data || typeof data !== 'object') return data
  const { ResponseCode, Description, LowProfileId } = data
  return { ResponseCode, Description, LowProfileId }
}

async function postCardcom(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    const error = new Error('Cardcom returned non-JSON')
    error.statusCode = 502
    error.raw = text.slice(0, 800)
    throw error
  }
}

function createLowProfile(body) {
  return postCardcom(CREATE_URL, body)
}

function getLpResult(body) {
  return postCardcom(RESULT_URL, body)
}

function chargeToken(body) {
  return postCardcom(TRANSACTION_URL, body)
}

// Lab webhook inspector only. Cardcom documents no signature/HMAC on the
// WebHookUrl callback, so every hit is an untrusted observation, never
// authoritative — GetLpResult stays the source of truth. This allowlist is
// what makes that safe to log/display at all: it strips everything except
// the fields we actually asked for, so no incidental PII (card data, UI
// form values) from the raw callback ever reaches a log line or the UI.
function summarizeWebhookPayload(body) {
  const data = body && typeof body === 'object' ? body : {}
  return {
    ResponseCode: data.ResponseCode,
    Description: data.Description,
    TerminalNumber: data.TerminalNumber,
    LowProfileId: data.LowProfileId,
    TranzactionId: data.TranzactionId,
    ReturnValue: data.ReturnValue,
    Operation: data.Operation,
    hasTokenInfo: Boolean(data.TokenInfo),
    hasTranzactionInfo: Boolean(data.TranzactionInfo),
    hasDocumentInfo: Boolean(data.DocumentInfo),
  }
}

module.exports = {
  CREATE_URL,
  RESULT_URL,
  TRANSACTION_URL,
  publicPayload,
  responseSummary,
  summarizeWebhookPayload,
  createLowProfile,
  getLpResult,
  chargeToken,
}
