import { MenuSelect } from './MenuSelect'
import { OPEN_FIELDS_REGIONS, type OpenFieldsRegion } from './previewVersions'

// 'new21' / 'openfields21' are the "2.1" variants: the same designs with the
// card fields regrouped into one bordered box (number | expiry / CVV).
export type Design = 'old' | 'new' | 'new21' | 'openfields' | 'openfields21'
export type Language = 'he' | 'en' | 'ar' | 'ru'
export type Device = 'mobile' | 'desktop'
export type Mode = 'redirect' | 'iframe'
export type OpenAs = 'page' | 'iframe' | 'phone'

export const DESIGNS: { value: Design; label: string }[] = [
  { value: 'new', label: 'New version' },
  { value: 'new21', label: 'New version 2.1 — card box' },
  { value: 'old', label: 'Old version' },
  { value: 'openfields', label: 'Open Fields' },
  { value: 'openfields21', label: 'Open Fields 2.1 — card box' },
]

// Family checks: everything true of "New version" is true of its 2.1, and
// likewise for Open Fields.
export const isNewDesign = (design: Design) => design === 'new' || design === 'new21'
export const isOpenFieldsDesign = (design: Design) =>
  design === 'openfields' || design === 'openfields21'

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
  region: OpenFieldsRegion
  openAs: OpenAs
  disabled?: boolean
  onDesignChange: (design: Design) => void
  onLanguageChange: (language: Language) => void
  onRegionChange: (region: OpenFieldsRegion) => void
  onOpenAsChange: (openAs: OpenAs) => void
}

export function CheckoutControls({
  design,
  language,
  region,
  openAs,
  disabled,
  onDesignChange,
  onLanguageChange,
  onRegionChange,
  onOpenAsChange,
}: CheckoutControlsProps) {
  // Open Fields' credits iframe only supports he/en upstream.
  const languageOptions = isOpenFieldsDesign(design)
    ? LANGUAGES.filter((option) => option.value === 'he' || option.value === 'en')
    : LANGUAGES
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
          options={languageOptions}
          disabled={disabled}
          onChange={onLanguageChange}
        />
      </div>

      {isOpenFieldsDesign(design) ? (
        <div className="cta-field">
          Template
          <MenuSelect
            aria-label="Template"
            value={region}
            options={OPEN_FIELDS_REGIONS}
            disabled={disabled}
            onChange={onRegionChange}
          />
        </div>
      ) : null}

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
