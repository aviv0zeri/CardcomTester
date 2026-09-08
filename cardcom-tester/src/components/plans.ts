// The guided walkthrough's subscription catalog (Slice 6). spectra-payments has no
// real Plan entity of its own -- a Subscription's amount/currency are just derived
// from whichever Payment activated it -- so a "plan" here is only ever a label the
// caller assigns and echoes back (external_plan_reference), mirroring how the
// one-time cart (cart.ts) is a local catalog too, not a real Product entity.

export type PlanLang = 'en' | 'he'

export type Plan = {
  id: string
  name: Record<PlanLang, string>
  blurb: Record<PlanLang, string>
  amount: number
  externalPlanReference: string
}

export const PLANS: Plan[] = [
  {
    id: 'basic',
    name: { en: 'Basic', he: 'בסיסי' },
    blurb: { en: 'For trying things out', he: 'להתנסות' },
    amount: 29.9,
    externalPlanReference: 'guided-plan-basic',
  },
  {
    id: 'pro',
    name: { en: 'Pro', he: 'פרו' },
    blurb: { en: 'For the real thing', he: 'לשימוש רציני' },
    amount: 79.9,
    externalPlanReference: 'guided-plan-pro',
  },
]
