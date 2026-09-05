import { useState } from 'react'
import { isNewDesign, isOpenFieldsDesign, type Design, type Device, type Language, type Mode } from './CheckoutControls'
import { MenuSelect } from './MenuSelect'
import { versionsFor, type PreviewVersion } from './previewVersions'

type VersionMenuProps = {
  design: Design
  language: Language
  device: Device
  mode: Mode
  busy?: boolean
  disabled?: boolean
  doubleView: boolean
  onDoubleViewChange: (value: boolean) => void
  dualMode: 'side-by-side' | 'continue'
  onDualModeChange: (mode: 'side-by-side' | 'continue') => void
  onLocal: (version?: PreviewVersion) => void
  onCardcom: (version?: PreviewVersion) => void
}

export function VersionMenu({
  design,
  language,
  device,
  mode,
  busy,
  disabled,
  doubleView,
  onDoubleViewChange,
  dualMode,
  onDualModeChange,
  onLocal,
  onCardcom,
}: VersionMenuProps) {
  const isMobile = device === 'mobile'
  const isRedirect = isMobile || mode === 'redirect'
  // Open Fields is a merchant-owned page. Preview opens it with preview=1 (no
  // API call at all); Cardcom API opens it live -- its own Continue button
  // creates the session. On a real phone it is always a plain page.
  const isOpenFields = isOpenFieldsDesign(design)
  const isNew = isNewDesign(design)
  const isPage = (!isMobile && isRedirect) || (isOpenFields && isMobile)
  const versions = versionsFor(device, isRedirect ? 'redirect' : 'iframe', design)
  const [sizeId, setSizeId] = useState(versions[0]?.id ?? '')
  const sizePick = versions.find((version) => version.id === sizeId) ?? versions[0]
  const blocked = disabled || busy
  const framed = !isPage && Boolean(sizePick)
  // Only meaningful in a sized/framed desktop iframe -- "old version" stays
  // untouched on purpose, and there's no room for two side-by-side panels on
  // a real phone. For Open Fields the two-panel view skips the page's own
  // cart screen and shows the tester's order summary in its place.
  const canDoubleView = (isNew || isOpenFields) && framed && !isMobile

  return (
    <section className="design-go">
      {framed && sizePick ? (
        <div className="cta-field">
          Size
          <MenuSelect
            aria-label="Size"
            value={sizePick.id}
            options={versions.map((version) => ({
              value: version.id,
              label: `${version.label} — ${version.note}`,
            }))}
            disabled={blocked}
            onChange={setSizeId}
          />
        </div>
      ) : null}

      <p className="cta-hint">
        {isOpenFields
          ? `Opens ${framed ? `a ${sizePick?.note ?? ''} iframe` : 'a full tab'} in ${language}. Preview is a mockup — no session. Cardcom API creates a real session when you continue to checkout.`
          : isPage
            ? `Opens a full tab in ${language}. Preview is this design. Live is a real Cardcom session.`
            : `Opens a ${sizePick?.note ?? ''} ${isMobile ? 'phone' : 'iframe'} in ${language}. Preview is this design. Live is a real Cardcom session.`}
      </p>

      {canDoubleView ? (
        <label className="cta-radio">
          <input
            type="checkbox"
            checked={doubleView}
            disabled={blocked}
            onChange={(event) => onDoubleViewChange(event.target.checked)}
          />
          Show order summary next to it (2 panels)
        </label>
      ) : null}
      {canDoubleView && doubleView ? (
        <div className="seg seg--small" role="radiogroup" aria-label="Two-panel layout">
          {(['side-by-side', 'continue'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`seg-btn${dualMode === option ? ' is-on' : ''}`}
              disabled={blocked}
              onClick={() => onDualModeChange(option)}
            >
              {option === 'side-by-side' ? 'Side by side' : 'Summary, then payment'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="cta-actions cta-actions--go">
        <button
          type="button"
          className={`cta-button${isNew || isOpenFields ? ' cta-button--secondary' : ''}`}
          disabled={blocked}
          onClick={() => onLocal(framed ? sizePick : undefined)}
        >
          Preview
        </button>
        {isNew || isOpenFields ? (
          <button
            type="button"
            className="cta-button"
            disabled={blocked}
            onClick={() => onCardcom(framed ? sizePick : undefined)}
          >
            {isOpenFields ? 'Cardcom API' : busy ? 'Creating…' : 'Live Cardcom'}
          </button>
        ) : null}
      </div>
    </section>
  )
}
