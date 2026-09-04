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
// Today there is exactly one business, GateOpen. Adding another is one entry
// here, its profile on the server, and its own Cardcom terminal.
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
]

export const DEFAULT_PROFILE = PROFILES[0]

export function profileById(id: string): BusinessProfile {
  return PROFILES.find((profile) => profile.id === id) ?? DEFAULT_PROFILE
}
