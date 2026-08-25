export type Language = 'he' | 'en' | 'ar' | 'ru'
export type Mode = 'redirect' | 'iframe'

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'he', label: 'Hebrew' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ru', label: 'Russian' },
]

const MODES: { value: Mode; label: string }[] = [
  { value: 'redirect', label: 'Redirect' },
  { value: 'iframe', label: 'Iframe' },
]

type CheckoutControlsProps = {
  language: Language
  mode: Mode
  disabled?: boolean
  onLanguageChange: (language: Language) => void
  onModeChange: (mode: Mode) => void
}

export function CheckoutControls({
  language,
  mode,
  disabled,
  onLanguageChange,
  onModeChange,
}: CheckoutControlsProps) {
  return (
    <div className="cta-fields">
      <label className="cta-field">
        Language
        <select
          value={language}
          disabled={disabled}
          onChange={(event) => onLanguageChange(event.target.value as Language)}
        >
          {LANGUAGES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="cta-field">
        Mode
        <select
          value={mode}
          disabled={disabled}
          onChange={(event) => onModeChange(event.target.value as Mode)}
        >
          {MODES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
