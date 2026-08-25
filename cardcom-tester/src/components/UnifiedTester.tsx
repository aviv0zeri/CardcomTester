import type { Language } from './CheckoutControls'

export type UnifiedPreset = {
  id: string
  label: string
  note: string
  width: number
  height: number
  embed: boolean
  scroll: boolean
}

export const UNIFIED_REDIRECT: UnifiedPreset[] = [
  { id: 'm-redir', label: 'Phone', note: '390×844 redirect', width: 390, height: 844, embed: false, scroll: true },
  { id: 'lp-redir', label: 'Large phone', note: '430×932 redirect', width: 430, height: 932, embed: false, scroll: true },
  { id: 'tp-redir', label: 'Tablet', note: '768×1024 redirect', width: 768, height: 1024, embed: false, scroll: true },
  { id: 'tl-redir', label: 'Tablet wide', note: '1024×768 redirect', width: 1024, height: 768, embed: false, scroll: true },
  { id: 'd-redir', label: 'Desktop', note: '1400×900 redirect', width: 1400, height: 900, embed: false, scroll: true },
]

export const UNIFIED_IFRAME: UnifiedPreset[] = [
  { id: 'm-iframe', label: 'Phone', note: '390×844 iframe', width: 390, height: 844, embed: true, scroll: true },
  { id: 'lp-iframe', label: 'Large phone', note: '430×932 iframe', width: 430, height: 932, embed: true, scroll: true },
  { id: 'tp-iframe', label: 'Tablet', note: '768×1024 iframe', width: 768, height: 1024, embed: true, scroll: true },
  { id: 'tl-iframe', label: 'Tablet wide', note: '1024×768 iframe', width: 1024, height: 768, embed: true, scroll: true },
  { id: 'd-iframe', label: 'Desktop', note: '1180×800 iframe', width: 1180, height: 800, embed: true, scroll: false },
]

export function unifiedPreviewUrl(language: Language, preset: UnifiedPreset) {
  const kind = preset.embed ? `${language}/embed` : language
  const params = new URLSearchParams({
    v: `low-profile/${kind}`,
    all: '1',
    wallets: '4',
  })
  return `/cardcom-preview/open.html?${params}`
}

type UnifiedTesterProps = {
  language: Language
  disabled?: boolean
  onOpen: (preset: UnifiedPreset) => void
}

function PresetRow({
  presets,
  disabled,
  onOpen,
  variant,
}: {
  presets: UnifiedPreset[]
  disabled?: boolean
  onOpen: (preset: UnifiedPreset) => void
  variant: 'primary' | 'secondary'
}) {
  const extra = variant === 'secondary' ? ' cta-button--secondary' : ''
  return (
    <div className="cta-actions cta-actions--unified">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`cta-button cta-button--stack${extra}`}
          disabled={disabled}
          onClick={() => onOpen(preset)}
        >
          {preset.label}
          <span className="cta-button-note">{preset.note}</span>
        </button>
      ))}
    </div>
  )
}

export function UnifiedTester({ language, disabled, onOpen }: UnifiedTesterProps) {
  return (
    <section className="cta-group cta-group--unified">
      <h2>All viewports</h2>
      <p className="cta-hint">
        One HTML + RTL/LTR CSS ({language}). Local _all copy — not live Cardcom.
      </p>

      <h3>Redirect</h3>
      <PresetRow
        presets={UNIFIED_REDIRECT}
        disabled={disabled}
        onOpen={onOpen}
        variant="primary"
      />

      <h3>Iframe</h3>
      <PresetRow
        presets={UNIFIED_IFRAME}
        disabled={disabled}
        onOpen={onOpen}
        variant="secondary"
      />
    </section>
  )
}
