import type { Language } from './CheckoutControls'

export type ClaudeFrame = {
  id: 'landscape' | 'squarish' | 'portrait'
  label: string
  width: number
  height: number
}

export const CLAUDE_FRAMES: ClaudeFrame[] = [
  { id: 'landscape', label: 'Landscape', width: 1180, height: 800 },
  { id: 'squarish', label: 'Squarish', width: 900, height: 720 },
  { id: 'portrait', label: 'Portrait', width: 640, height: 1080 },
]

export function claudePreviewUrl(language: Language, hideInvoice: boolean) {
  const params = new URLSearchParams({
    v: `low-profile/${language}/embed`,
    wip: '1',
    wallets: '4',
  })
  if (hideInvoice) params.set('billing', '0')
  return `/cardcom-preview/open.html?${params}`
}

type ClaudeTesterProps = {
  language: Language
  disabled?: boolean
  onOpen: (frame: ClaudeFrame, hideInvoice: boolean) => void
}

export function ClaudeTester({ language, disabled, onOpen }: ClaudeTesterProps) {
  return (
    <section className="cta-group cta-group--claude">
      <h2>Claude tester</h2>
      <p className="cta-hint">
        Local _wip compact iframe ({language}). Not a live Cardcom session.
      </p>

      <div className="cta-actions cta-actions--sizes">
        {CLAUDE_FRAMES.map((frame) => (
          <button
            key={frame.id}
            type="button"
            className="cta-button cta-button--stack"
            disabled={disabled}
            onClick={() => onOpen(frame, false)}
          >
            {frame.label}
            <span className="cta-button-note">
              {frame.width}×{frame.height}
            </span>
          </button>
        ))}
      </div>

      <h3>Without invoice</h3>
      <div className="cta-actions cta-actions--sizes">
        {CLAUDE_FRAMES.map((frame) => (
          <button
            key={`${frame.id}-nobill`}
            type="button"
            className="cta-button cta-button--secondary cta-button--stack"
            disabled={disabled}
            onClick={() => onOpen(frame, true)}
          >
            {frame.label}
            <span className="cta-button-note">
              {frame.width}×{frame.height}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
