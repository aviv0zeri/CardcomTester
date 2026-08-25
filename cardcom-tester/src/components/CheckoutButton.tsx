import { useState } from 'react'
import type { Language } from './CheckoutControls'

type CheckoutButtonProps = {
  language: Language
  disabled?: boolean
  onUrl: (url: string) => void
  onError: (message: string) => void
}

export function CheckoutButton({
  language,
  disabled,
  onUrl,
  onError,
}: CheckoutButtonProps) {
  const [busy, setBusy] = useState(false)

  const createSession = async () => {
    if (busy) return

    setBusy(true)

    try {
      const response = await fetch('/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 10,
          profileId: 'tester',
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
        onError('Express API is not running on :3000. Run cardcom_tester.')
        setBusy(false)
        return
      }

      const url = data.Url || data.url
      if (Number(data.ResponseCode) === 0 && url) {
        onUrl(url)
        setBusy(false)
        return
      }

      const description = data.Description || data.message || 'no description'
      onError(`Cardcom error: ${data.ResponseCode} — ${description}`)
    } catch (error) {
      const description = error instanceof Error ? error.message : 'request failed'
      onError(`${description}. Is Express on :3000? Run cardcom_tester.`)
    }

    setBusy(false)
  }

  return (
    <div className="cta-actions">
      <button
        type="button"
        className="cta-button"
        disabled={disabled || busy}
        onClick={() => void createSession()}
      >
        {busy ? 'Creating session…' : 'Open checkout'}
      </button>
    </div>
  )
}
