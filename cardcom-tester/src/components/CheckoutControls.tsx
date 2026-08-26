import { MenuSelect } from './MenuSelect'

export type Design = 'old' | 'new'
export type Language = 'he' | 'en' | 'ar' | 'ru'
export type Device = 'mobile' | 'desktop'
export type Mode = 'redirect' | 'iframe'
export type OpenAs = 'page' | 'iframe' | 'phone'

export const DESIGNS: { value: Design; label: string }[] = [
  { value: 'new', label: 'New version' },
  { value: 'old', label: 'Old version' },
]

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'he', label: 'Hebrew' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ru', label: 'Russian' },
]

const OPEN_AS: { value: OpenAs; label: string }[] = [
  { value: 'page', label: 'Page' },
  { value: 'iframe', label: 'Iframe' },
  { value: 'phone', label: 'Phone' },
]

export function openAsFrom(device: Device, mode: Mode): OpenAs {
  if (device === 'mobile') return 'phone'
  if (mode === 'iframe') return 'iframe'
  return 'page'
}

export function deviceModeFrom(openAs: OpenAs): { device: Device; mode: Mode } {
  if (openAs === 'phone') return { device: 'mobile', mode: 'redirect' }
  if (openAs === 'iframe') return { device: 'desktop', mode: 'iframe' }
  return { device: 'desktop', mode: 'redirect' }
}

type CheckoutControlsProps = {
  design: Design
  language: Language
  openAs: OpenAs
  disabled?: boolean
  onDesignChange: (design: Design) => void
  onLanguageChange: (language: Language) => void
  onOpenAsChange: (openAs: OpenAs) => void
}

export function CheckoutControls({
  design,
  language,
  openAs,
  disabled,
  onDesignChange,
  onLanguageChange,
  onOpenAsChange,
}: CheckoutControlsProps) {
  return (
    <div className="cta-fields">
      <div className="cta-field">
        Version
        <MenuSelect
          aria-label="Version"
          value={design}
          options={DESIGNS}
          disabled={disabled}
          onChange={onDesignChange}
        />
      </div>

      <div className="cta-field">
        Language
        <MenuSelect
          aria-label="Language"
          value={language}
          options={LANGUAGES}
          disabled={disabled}
          onChange={onLanguageChange}
        />
      </div>

      <fieldset className="cta-field" disabled={disabled}>
        <legend className="seg-legend">Open as</legend>
        <div className="seg" role="radiogroup" aria-label="Open as">
          {OPEN_AS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`seg-btn${openAs === option.value ? ' is-on' : ''}`}
              disabled={disabled}
              aria-pressed={openAs === option.value}
              onClick={() => onOpenAsChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
