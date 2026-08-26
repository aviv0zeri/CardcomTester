const CREATE_URL = 'https://secure.cardcom.solutions/api/v11/LowProfile/Create'
const RESULT_URL = 'https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult'

function publicPayload(body) {
  if (!body || typeof body !== 'object') return body
  const copy = { ...body }
  delete copy.ApiPassword
  return copy
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

module.exports = {
  CREATE_URL,
  RESULT_URL,
  publicPayload,
  createLowProfile,
  getLpResult,
}
