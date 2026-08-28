const { getProfile, buildTokenChargeBody } = require('../server/profiles')
const { chargeToken } = require('../server/cardcom')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'POST only' })
    return
  }

  try {
    const profile = getProfile(req.body && req.body.profileId)
    const body = buildTokenChargeBody(profile, req.body)
    const cardcom = await chargeToken(body)
    res.status(200).json({ cardcom })
  } catch (error) {
    const status = error.statusCode === 400 ? 400 : error.statusCode === 502 ? 502 : 500
    res.status(status).json({
      message: status === 400 ? error.message : error.message || 'Cardcom request failed',
      raw: error.raw,
    })
  }
}
