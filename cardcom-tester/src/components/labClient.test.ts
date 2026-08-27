import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  asRecord,
  asText,
  checkLabResult,
  createLabSession,
  newProduct,
  productAmount,
  responseCode,
  type LabCustomer,
  type LabProduct,
} from './labClient'

function mockFetchOnce(status: number, body: string) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('productAmount', () => {
  it('sums quantity * unitCost across rows', () => {
    const rows: LabProduct[] = [
      { id: '1', description: 'a', quantity: '2', unitCost: '10' },
      { id: '2', description: 'b', quantity: '3', unitCost: '5.5' },
    ]
    expect(productAmount(rows)).toBe(36.5)
  })

  it('avoids floating point drift on decimal unit costs', () => {
    const rows: LabProduct[] = [{ id: '1', description: 'a', quantity: '3', unitCost: '0.1' }]
    expect(productAmount(rows)).toBe(0.3)
  })

  it('skips rows with non-numeric quantity or unitCost', () => {
    const rows: LabProduct[] = [
      { id: '1', description: 'a', quantity: '2', unitCost: '10' },
      { id: '2', description: 'bad', quantity: 'abc', unitCost: '10' },
      { id: '3', description: 'bad', quantity: '2', unitCost: '' },
    ]
    expect(productAmount(rows)).toBe(20)
  })

  it('returns 0 for an empty list', () => {
    expect(productAmount([])).toBe(0)
  })
})

describe('asRecord', () => {
  it('passes through plain objects', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 })
  })

  it('rejects arrays', () => {
    expect(asRecord([1, 2])).toBeNull()
  })

  it('rejects null, undefined, and primitives', () => {
    expect(asRecord(null)).toBeNull()
    expect(asRecord(undefined)).toBeNull()
    expect(asRecord('x')).toBeNull()
    expect(asRecord(42)).toBeNull()
  })
})

describe('asText', () => {
  it('coerces numbers and booleans to strings', () => {
    expect(asText(42)).toBe('42')
    expect(asText(false)).toBe('false')
  })

  it('treats undefined, null, and empty string as empty', () => {
    expect(asText(undefined)).toBe('')
    expect(asText(null)).toBe('')
    expect(asText('')).toBe('')
  })

  it('passes through non-empty strings', () => {
    expect(asText('hello')).toBe('hello')
  })
})

describe('responseCode', () => {
  it('extracts a numeric ResponseCode', () => {
    expect(responseCode({ ResponseCode: 0 })).toBe(0)
    expect(responseCode({ ResponseCode: '5119' })).toBe(5119)
  })

  it('returns null for a missing or non-finite ResponseCode', () => {
    expect(responseCode({})).toBeNull()
    expect(responseCode({ ResponseCode: 'not-a-number' })).toBeNull()
  })

  it('returns null for a null payload', () => {
    expect(responseCode(null)).toBeNull()
  })
})

describe('newProduct', () => {
  it('returns the default single test-item shape', () => {
    const product = newProduct()
    expect(product.description).toBe('Test item')
    expect(product.quantity).toBe('1')
    expect(product.unitCost).toBe('10')
    expect(typeof product.id).toBe('string')
    expect(product.id.length).toBeGreaterThan(0)
  })
})

const EMPTY_CUSTOMER: LabCustomer = {
  name: '',
  taxId: '',
  email: '',
  isSendByEmail: false,
  addressLine1: '',
  city: '',
  mobile: '',
}

describe('createLabSession request shape', () => {
  it('omits Document for the charge scenario', async () => {
    const fetchMock = mockFetchOnce(200, JSON.stringify({ cardcom: { ResponseCode: 0 } }))
    await createLabSession({
      language: 'he',
      scenario: 'charge',
      amount: '10',
      documentType: 'TaxInvoiceAndReceipt',
      returnValue: '',
      products: [newProduct()],
      customer: EMPTY_CUSTOMER,
    })
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.includeDocument).toBe(false)
    expect(body.products).toBeUndefined()
    expect(body.customer).toBeUndefined()
  })

  it('includes Products for the document scenario', async () => {
    const fetchMock = mockFetchOnce(200, JSON.stringify({ cardcom: { ResponseCode: 0 } }))
    const products: LabProduct[] = [{ id: '1', description: 'Widget', quantity: '2', unitCost: '5' }]
    await createLabSession({
      language: 'en',
      scenario: 'document',
      amount: '10',
      documentType: 'TaxInvoice',
      returnValue: '',
      products,
      customer: EMPTY_CUSTOMER,
    })
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.includeDocument).toBe(true)
    expect(body.products).toEqual([{ description: 'Widget', quantity: 2, unitCost: 5 }])
    expect(body.customer).toBeUndefined()
  })

  it('includes customer fields only for the customer scenario', async () => {
    const fetchMock = mockFetchOnce(200, JSON.stringify({ cardcom: { ResponseCode: 0 } }))
    await createLabSession({
      language: 'en',
      scenario: 'customer',
      amount: '10',
      documentType: 'TaxInvoiceAndReceipt',
      returnValue: '',
      products: [newProduct()],
      customer: { ...EMPTY_CUSTOMER, name: 'Jane', email: 'jane@example.com' },
    })
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.customer).toEqual({
      name: 'Jane',
      taxId: '',
      email: 'jane@example.com',
      isSendByEmail: false,
      addressLine1: '',
      city: '',
      mobile: '',
    })
  })

  it('trims and forwards a non-empty returnValue, omits it when blank', async () => {
    const fetchMock = mockFetchOnce(200, JSON.stringify({ cardcom: { ResponseCode: 0 } }))
    await createLabSession({
      language: 'he',
      scenario: 'charge',
      amount: '10',
      documentType: 'TaxInvoiceAndReceipt',
      returnValue: '  order-42  ',
      products: [newProduct()],
      customer: EMPTY_CUSTOMER,
    })
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string).returnValue).toBe('order-42')
  })
})

describe('error classification', () => {
  it('surfaces the server message on a non-ok response', async () => {
    mockFetchOnce(400, JSON.stringify({ message: 'amount must be a number greater than 0' }))
    await expect(
      createLabSession({
        language: 'he',
        scenario: 'charge',
        amount: '0',
        documentType: 'TaxInvoiceAndReceipt',
        returnValue: '',
        products: [newProduct()],
        customer: EMPTY_CUSTOMER,
      }),
    ).rejects.toThrow('amount must be a number greater than 0')
  })

  it('falls back to the HTTP status when the server sends no message', async () => {
    mockFetchOnce(500, JSON.stringify({}))
    await expect(checkLabResult('some-id')).rejects.toThrow('HTTP 500')
  })

  it('reports the Express-down case on a non-JSON response', async () => {
    mockFetchOnce(200, '<html>not json</html>')
    await expect(checkLabResult('some-id')).rejects.toThrow(/Express API is not running/)
  })
})
