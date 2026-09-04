import { useState } from 'react'
import type { Design, Device, Language, Mode } from './CheckoutControls'
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
  onLocal,
  onCardcom,
}: VersionMenuProps) {
  const isMobile = device === 'mobile'
  const isRedirect = isMobile || mode === 'redirect'
  // Open Fields is a merchant-owned page, not a hosted-page framing target --
  // no size/iframe variants exist upstream. Always treat it as a plain
  // full-tab page. Preview opens it with preview=1 (no API call at all);
  // Cardcom API opens it live -- its own Continue button creates the session.
  const isOpenFields = design === 'openfields'
  const isPage = (!isMobile && isRedirect) || isOpenFields
  const versions = isOpenFields ? [] : versionsFor(device, isRedirect ? 'redirect' : 'iframe', design)
  const [sizeId, setSizeId] = useState(versions[0]?.id ?? '')
  const sizePick = versions.find((version) => version.id === sizeId) ?? versions[0]
  const blocked = disabled || busy
  const framed = !isPage
  // Only meaningful for "new version" in a sized/framed desktop iframe --
  // Open Fields has its own real first-screen cart already, "old version"
  // stays untouched on purpose, and there's no room for two side-by-side
  // panels on a real phone.
  const canDoubleView = design === 'new' && framed && !isMobile

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
          ? `Opens a full tab in ${language}. Preview is a mockup — no session. Cardcom API creates a real session when you continue to checkout.`
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

      <div className="cta-actions cta-actions--go">
        <button
          type="button"
          className={`cta-button${design === 'new' || isOpenFields ? ' cta-button--secondary' : ''}`}
          disabled={blocked}
          onClick={() => onLocal(framed ? sizePick : undefined)}
        >
          Preview
        </button>
        {design === 'new' || isOpenFields ? (
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
