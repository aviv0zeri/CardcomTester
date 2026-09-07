import type { UiLang } from './uiLang'

// Shared by every "inspection console" tab (Customers, Subscriptions,
// Subscription Detail) that renders persisted spectra-payments resources.

export function fmtDate(iso: string | null, lang: UiLang): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function StatusBadge({ status }: { status: string }) {
  const cls = status.toLowerCase().replace(/[^a-z]+/g, '-')
  return <span className={`ct-status ct-status--${cls}`}>{status}</span>
}
