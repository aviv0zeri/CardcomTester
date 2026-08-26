const { getProfile, buildLabCreateBody } = require('../server/profiles')
const { createLowProfile, publicPayload } = require('../server/cardcom')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'POST only' })
    return
  }

  try {
    const profile = getProfile(req.body && req.body.profileId)
    const { body, amount, includeDocument } = buildLabCreateBody(profile, req.body)
    const cardcom = await createLowProfile(body)
    res.status(200).json({
      sent: {
        Amount: amount,
        Language: body.Language,
        Operation: body.Operation,
        includeDocument,
        productCount: body.Document && body.Document.Products ? body.Document.Products.length : 0,
        request: publicPayload(body),
      },
      cardcom,
    })
  } catch (error) {
    const status = error.statusCode === 400 ? 400 : error.statusCode === 502 ? 502 : 500
    res.status(status).json({
      message: status === 400 ? error.message : error.message || 'Cardcom request failed',
      raw: error.raw,
    })
  }
}
