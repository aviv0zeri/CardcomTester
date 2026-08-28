const { recordWebhookHit, listWebhookHits } = require('../server/webhookStore')

// LAB / UNTRUSTED. This is Cardcom's WebHookUrl target for the lab's
// experimental Create requests. Cardcom documents no signature or HMAC on
// this callback, so a hit here is never treated as authoritative — it only
// records/displays an allowlisted summary (see cardcom.js) for inspection.
// GetLpResult remains the source of truth for real transaction state.
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const entry = recordWebhookHit(req.body)
    // Deliberate, opt-in, single-call non-200 for observing Cardcom's own
    // retry behavior — never triggered automatically, never repeated by us.
    const failOnce = req.query.fail === '1' || req.query.fail === 'true'
    res.status(failOnce ? 500 : 200).json({ received: true, entry })
    return
  }

  if (req.method === 'GET') {
    res.status(200).json({ hits: listWebhookHits() })
    return
  }

  res.status(405).json({ message: 'GET or POST only' })
}
