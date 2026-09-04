import type { Language } from './CheckoutControls'
import { DEFAULT_PROFILE } from './profiles'

export async function createCardcomSession(
  language: Language,
  // Which business (Cardcom terminal) -- server/profiles.js key.
  profileId: string = DEFAULT_PROFILE.expressProfileId,
): Promise<string> {
  const response = await fetch('/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 10,
      profileId,
      language,
    }),
  })

  const text = await response.text()
  let data: {
    ResponseCode?: number | string
    Description?: string
    Url?: string
    url?: string
    message?: string
  }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Express API is not running on :3000. Run cardcom tester.')
  }

  const url = data.Url || data.url
  if (Number(data.ResponseCode) === 0 && url) return url

  const description = data.Description || data.message || 'no description'
  if (Number(data.ResponseCode) === 605) {
    throw new Error('Cardcom server is unavailable right now. Back Sunday–Thursday until 17:00.')
  }
  throw new Error(`Cardcom error: ${data.ResponseCode} — ${description}`)
}
