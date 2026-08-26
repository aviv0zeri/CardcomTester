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
  onLocal,
  onCardcom,
}: VersionMenuProps) {
  const isMobile = device === 'mobile'
  const isRedirect = isMobile || mode === 'redirect'
  const isPage = !isMobile && isRedirect
  const versions = versionsFor(device, isRedirect ? 'redirect' : 'iframe', design)
  const [sizeId, setSizeId] = useState(versions[0]?.id ?? '')
  const sizePick = versions.find((version) => version.id === sizeId) ?? versions[0]
  const blocked = disabled || busy
  const framed = !isPage

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
        {isPage
          ? `Opens a full tab in ${language}. Preview is this design. Live is a real Cardcom session.`
          : `Opens a ${sizePick?.note ?? ''} ${isMobile ? 'phone' : 'iframe'} in ${language}. Preview is this design. Live is a real Cardcom session.`}
      </p>

      <div className="cta-actions cta-actions--go">
        <button
          type="button"
          className={`cta-button${design === 'old' ? '' : ' cta-button--secondary'}`}
          disabled={blocked}
          onClick={() => onLocal(framed ? sizePick : undefined)}
        >
          Preview
        </button>
        {design === 'old' ? null : (
          <button
            type="button"
            className="cta-button"
            disabled={blocked}
            onClick={() => onCardcom(framed ? sizePick : undefined)}
          >
            {busy ? 'Creating…' : 'Live Cardcom'}
          </button>
        )}
      </div>
    </section>
  )
}
