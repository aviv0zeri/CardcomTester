const { getProfile, buildLowProfileBody } = require('../server/profiles')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'POST only' })
    return
  }

  try {
    const amount = req.body && req.body.amount
    const language = req.body && req.body.language
    const profile = getProfile(req.body && req.body.profileId)
    const payload = buildLowProfileBody(profile, amount, language)

    const cardcomResponse = await fetch(
      'https://secure.cardcom.solutions/api/v11/LowProfile/Create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )

    const data = await cardcomResponse.json()
    res.status(200).json(data)
  } catch (error) {
    const status = error.statusCode === 400 ? 400 : 500
    res.status(status).json({
      message: status === 400 ? error.message : 'Cardcom request failed',
    })
  }
}
