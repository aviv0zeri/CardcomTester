const { summarizeWebhookPayload } = require('./cardcom')

// In-memory only, capped, process-lifetime — a lab convenience, not
// persistence. Reliable on the local Express server (one long-lived
// process). On Vercel this resets on cold start and is not shared across
// concurrent instances, so retry/occurrence counts are only meaningful
// within a single warm instance during one testing burst — not guaranteed
// across the deployed environment over time.
const MAX_HITS = 25
let hits = []

function recordWebhookHit(rawBody) {
  const entry = {
    receivedAt: new Date().toISOString(),
    ...summarizeWebhookPayload(rawBody),
  }
  hits.push(entry)
  if (hits.length > MAX_HITS) hits = hits.slice(-MAX_HITS)
  return entry
}

function listWebhookHits() {
  return hits
}

module.exports = {
  recordWebhookHit,
  listWebhookHits,
}
