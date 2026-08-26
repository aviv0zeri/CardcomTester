import type { Language } from './CheckoutControls'

export type LabScenario = 'charge' | 'document' | 'customer'

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
}) {
  const includeDocument = input.scenario !== 'charge'
  const body: Record<string, unknown> = {
    profileId: 'tester',
    language: input.language,
    amount: Number(input.amount),
    includeDocument,
    documentType: input.documentType,
  }
  if (input.returnValue.trim()) body.returnValue = input.returnValue.trim()
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
