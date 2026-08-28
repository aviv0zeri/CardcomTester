import { describe, expect, it } from 'vitest'
const { summarizeWebhookPayload } = require('./cardcom')

describe('summarizeWebhookPayload', () => {
  it('extracts only the allowlisted fields', () => {
    const summary = summarizeWebhookPayload({
      ResponseCode: 0,
      Description: 'ok',
      TerminalNumber: 1000,
      LowProfileId: 'lp-1',
      TranzactionId: 555,
      ReturnValue: 'order-42',
      Operation: 'ChargeAndCreateToken',
      TokenInfo: { Token: 'secret-token', CardOwnerIdentityNumber: '123456789' },
      TranzactionInfo: { Amount: 10 },
      DocumentInfo: { DocumentNumber: 7 },
      UIValues: { CardOwnerEmail: 'someone@example.com' },
    })

    expect(summary).toEqual({
      ResponseCode: 0,
      Description: 'ok',
      TerminalNumber: 1000,
      LowProfileId: 'lp-1',
      TranzactionId: 555,
      ReturnValue: 'order-42',
      Operation: 'ChargeAndCreateToken',
      hasTokenInfo: true,
      hasTranzactionInfo: true,
      hasDocumentInfo: true,
    })
  })

  it('never surfaces nested PII — no TokenInfo/UIValues keys of any kind survive', () => {
    const summary = summarizeWebhookPayload({
      TokenInfo: { Token: 'secret-token', CardOwnerIdentityNumber: '123456789' },
      UIValues: { CardOwnerEmail: 'someone@example.com' },
    })
    const keys = Object.keys(summary)
    expect(keys).not.toContain('TokenInfo')
    expect(keys).not.toContain('UIValues')
    expect(JSON.stringify(summary)).not.toContain('secret-token')
    expect(JSON.stringify(summary)).not.toContain('123456789')
  })

  it('reports presence as false when the sub-object is absent', () => {
    const summary = summarizeWebhookPayload({ ResponseCode: 0 })
    expect(summary.hasTokenInfo).toBe(false)
    expect(summary.hasTranzactionInfo).toBe(false)
    expect(summary.hasDocumentInfo).toBe(false)
  })

  it('handles a non-object payload without throwing', () => {
    expect(summarizeWebhookPayload(null)).toMatchObject({ hasTokenInfo: false })
    expect(summarizeWebhookPayload(undefined)).toMatchObject({ hasTokenInfo: false })
    expect(summarizeWebhookPayload('not an object')).toMatchObject({ hasTokenInfo: false })
  })
})
