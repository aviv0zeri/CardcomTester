import type { Language } from './CheckoutControls'

export type LabScenario = 'charge' | 'document' | 'customer' | 'token'

// Cardcom's documented Operation values this lab exposes for the Token
// scenario. ChargeOnly (the profile default) is never sent through here.
export type LabOperation = 'ChargeAndCreateToken' | 'CreateTokenOnly'

// Cardcom's documented AdvancedLPDefinition.JValidateType values, verbatim —
// scoped to CreateTokenOnly only (see profiles.js).
export type JValidateType = 'J2' | 'J5'

export type LabProduct = {
  id: string
  description: string
  quantity: string
  unitCost: string
}

export type LabCustomer = {
  name: string
  taxId: string
  email: string
  isSendByEmail: boolean
  addressLine1: string
  city: string
  mobile: string
}

export type CardcomPayload = Record<string, unknown>

type LabEnvelope = {
  sent?: CardcomPayload
  cardcom?: CardcomPayload
  message?: string
  raw?: string
}

const STORAGE_KEY = 'cardcom-lab-lowprofileid'

async function postLab(path: string, body: unknown): Promise<LabEnvelope> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let data: LabEnvelope
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Express API is not running on :3000. Run cardcom tester.')
  }
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`)
  }
  return data
}

export function newProduct(): LabProduct {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: 'Test item',
    quantity: '1',
    unitCost: '10',
  }
}

export function productAmount(products: LabProduct[]): number {
  return Math.round(
    products.reduce((sum, row) => {
      const quantity = Number(row.quantity)
      const unitCost = Number(row.unitCost)
      if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) return sum
      return sum + quantity * unitCost
    }, 0) * 100,
  ) / 100
}

export function readStoredLowProfileId(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function storeLowProfileId(id: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* disposable convenience only */
  }
}

export function createLabSession(input: {
  language: Language
  scenario: LabScenario
  amount: string
  documentType: string
  returnValue: string
  products: LabProduct[]
  customer: LabCustomer
  webHookUrl?: string
  operation?: LabOperation
  jValidateType?: JValidateType
}) {
  // Token experiments don't want an invoice muddying the result — only
  // document/customer opt into Document, same as before this scenario existed.
  const includeDocument = input.scenario === 'document' || input.scenario === 'customer'
  const body: Record<string, unknown> = {
    profileId: 'tester',
    language: input.language,
    amount: Number(input.amount),
    includeDocument,
    documentType: input.documentType,
  }
  if (input.returnValue.trim()) body.returnValue = input.returnValue.trim()
  if ((input.webHookUrl ?? '').trim()) body.webHookUrl = (input.webHookUrl ?? '').trim()
  if (input.operation) body.operation = input.operation
  if (input.jValidateType) body.jValidateType = input.jValidateType
  if (includeDocument) {
    body.products = input.products.map((row) => ({
      description: row.description,
      quantity: Number(row.quantity),
      unitCost: Number(row.unitCost),
    }))
  }
  if (input.scenario === 'customer') {
    body.customer = {
      name: input.customer.name,
      taxId: input.customer.taxId,
      email: input.customer.email,
      isSendByEmail: input.customer.isSendByEmail,
      addressLine1: input.customer.addressLine1,
      city: input.customer.city,
      mobile: input.customer.mobile,
    }
  }
  return postLab('/lab/create', body)
}

export function checkLabResult(lowProfileId: string) {
  return postLab('/lab/result', {
    profileId: 'tester',
    lowProfileId,
  })
}

// Stored-token charge (POST /api/v11/Transactions/Transaction). Token +
// Amount are the only fields Cardcom's schema actually requires — expiration
// and CVV2 are optional and included only if the experiment calls for them.
// There is deliberately no card-number field: raw PAN never passes through
// this app, only through Cardcom's own hosted Low Profile page.
export function chargeStoredToken(input: {
  token: string
  amount: string
  externalUniqTranId?: string
  cardExpirationMMYY?: string
  cvv2?: string
}) {
  const body: Record<string, unknown> = {
    profileId: 'tester',
    token: input.token.trim(),
    amount: Number(input.amount),
  }
  if ((input.externalUniqTranId ?? '').trim()) {
    body.externalUniqTranId = (input.externalUniqTranId ?? '').trim()
  }
  if ((input.cardExpirationMMYY ?? '').trim()) {
    body.cardExpirationMMYY = (input.cardExpirationMMYY ?? '').trim()
  }
  if ((input.cvv2 ?? '').trim()) {
    body.cvv2 = (input.cvv2 ?? '').trim()
  }
  return postLab('/lab/charge-token', body)
}

// A simple, non-secret lab idempotency key — not a production mechanism.
export function generateExternalUniqTranId(): string {
  return `lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function asRecord(value: unknown): CardcomPayload | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as CardcomPayload)
    : null
}

export function asText(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  return String(value)
}

export function responseCode(payload: CardcomPayload | null): number | null {
  if (!payload || payload.ResponseCode === undefined || payload.ResponseCode === null) {
    return null
  }
  const code = Number(payload.ResponseCode)
  return Number.isFinite(code) ? code : null
}

export type TokenInfoView = {
  token: string
  tokenExDate: string
  cardYear: string
  cardMonth: string
  tokenApprovalNumber: string
}

// Deliberately excludes TokenInfo.CardOwnerIdentityNumber — Cardcom's own
// guidance to "save all of the information" for the charge process doesn't
// mean this lab (or a future production system) should surface or retain
// PII it has no use for. This is the only place TokenInfo is read out of a
// raw Cardcom payload, so the omission holds everywhere this is used.
export function tokenInfoView(tokenInfo: CardcomPayload | null): TokenInfoView | null {
  if (!tokenInfo) return null
  return {
    token: asText(tokenInfo.Token),
    tokenExDate: asText(tokenInfo.TokenExDate),
    cardYear: asText(tokenInfo.CardYear),
    cardMonth: asText(tokenInfo.CardMonth),
    tokenApprovalNumber: asText(tokenInfo.TokenApprovalNumber),
  }
}

// LAB / UNTRUSTED — mirrors the allowlist server/cardcom.js#summarizeWebhookPayload
// applies before a callback is ever stored. Never authoritative; GetLpResult is.
export type WebhookHit = {
  receivedAt: string
  ResponseCode?: number | string
  Description?: string
  TerminalNumber?: number | string
  LowProfileId?: string
  TranzactionId?: number | string
  ReturnValue?: string
  Operation?: string
  hasTokenInfo?: boolean
  hasTranzactionInfo?: boolean
  hasDocumentInfo?: boolean
}

export async function fetchWebhookHits(): Promise<WebhookHit[]> {
  const response = await fetch('/lab/webhook')
  const text = await response.text()
  let data: { hits?: WebhookHit[] }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Express API is not running on :3000. Run cardcom tester.')
  }
  return Array.isArray(data.hits) ? data.hits : []
}

// Groups hits by LowProfileId so retries (the same callback arriving more
// than once) are visible without the server needing to track counts itself.
export function countWebhookHits(hits: WebhookHit[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const hit of hits) {
    const id = hit.LowProfileId
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}
