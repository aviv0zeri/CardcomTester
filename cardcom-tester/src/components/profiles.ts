// Business profiles ("which business, which Cardcom terminal"). One entry per
// business the tester can act as. A profile bundles everything that has to
// change together when the business changes:
//   - expressProfileId: the Express payment profile (server/profiles.js) that
//     selects the Cardcom account + terminal. Credentials never leave the server.
//   - spectraProjectId: the spectra-payments project_id. Every Customer,
//     CheckoutSession and Payment row is partitioned by it, so each business
//     owns its own data on our side.
//   - logo: the brand shown on the checkout pages (Open Fields brand header).
//   - accent: the checkout page's default accent colour for this business
//     (the walkthrough lets you override it per run to try others).
// Adding another business is one entry here, its profile on the server (if it
// needs its own Cardcom terminal -- it doesn't have to: `cardcom-tester` below
// deliberately reuses GateOpen's terminal, since its only purpose is to be a
// second real spectra-payments project_id, not a second Cardcom account), and
// -- for a genuinely new project_id -- a second server-side credential in the
// proxy (see server/spectraProxy.js's per-profile token lookup).
export type BusinessProfile = {
  id: string
  name: string
  expressProfileId: string
  spectraProjectId: string
  logoLight: string
  logoDark: string
  accent: string
}

export const PROFILES: BusinessProfile[] = [
  {
    id: 'gateopen',
    name: 'GateOpen',
    expressProfileId: 'gateopen',
    spectraProjectId: 'gateopen',
    logoLight: '/cardcom-preview/brand/gateopen-light.svg',
    logoDark: '/cardcom-preview/brand/gateopen-dark.svg',
    accent: '#3d5580',
  },
  {
    // A second REAL spectra-payments project (its own project_id, its own
    // issued api_credentials row, its own server-side token) -- not a real
    // business. It exists so the profile selector actually proves project
    // isolation instead of just rendering a dropdown around GateOpen's data.
    // Cardcom side is deliberately shared with GateOpen (same test terminal --
    // project isolation is a spectra-payments/data concern, not a Cardcom one).
    id: 'cardcom-tester',
    name: 'Cardcom Tester',
    expressProfileId: 'gateopen',
    spectraProjectId: 'cardcom-tester',
    logoLight: '/cardcom-preview/brand/cardcom-tester-light.svg',
    logoDark: '/cardcom-preview/brand/cardcom-tester-dark.svg',
    accent: '#c97a3a',
  },
]

export const DEFAULT_PROFILE = PROFILES[0]

export function profileById(id: string): BusinessProfile {
  return PROFILES.find((profile) => profile.id === id) ?? DEFAULT_PROFILE
}
