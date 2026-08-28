import { describe, expect, it } from 'vitest'
const { getProfile, buildLabCreateBody, buildTokenChargeBody } = require('./profiles')

const profile = getProfile('tester')

describe('buildLabCreateBody — Operation selection', () => {
  it('defaults to ChargeOnly when no operation is requested', () => {
    const { body } = buildLabCreateBody(profile, { language: 'he', amount: 10 })
    expect(body.Operation).toBe('ChargeOnly')
  })

  it('accepts ChargeAndCreateToken', () => {
    const { body } = buildLabCreateBody(profile, {
      language: 'he',
      amount: 10,
      operation: 'ChargeAndCreateToken',
    })
    expect(body.Operation).toBe('ChargeAndCreateToken')
  })

  it('accepts CreateTokenOnly', () => {
    const { body } = buildLabCreateBody(profile, {
      language: 'he',
      amount: 10,
      operation: 'CreateTokenOnly',
    })
    expect(body.Operation).toBe('CreateTokenOnly')
  })

  it('ignores an operation outside the lab allowlist', () => {
    const { body } = buildLabCreateBody(profile, {
      language: 'he',
      amount: 10,
      operation: 'Do3DSAndSubmit',
    })
    expect(body.Operation).toBe('ChargeOnly')
  })
})

describe('buildLabCreateBody — WebHookUrl', () => {
  it('omits WebHookUrl when not provided', () => {
    const { body } = buildLabCreateBody(profile, { language: 'he', amount: 10 })
    expect(body.WebHookUrl).toBeUndefined()
  })

  it('sets WebHookUrl only when explicitly given', () => {
    const { body } = buildLabCreateBody(profile, {
      language: 'he',
      amount: 10,
      webHookUrl: 'https://cardcom-tester.vercel.app/lab/webhook',
    })
    expect(body.WebHookUrl).toBe('https://cardcom-tester.vercel.app/lab/webhook')
  })

  it('treats a blank WebHookUrl as not provided', () => {
    const { body } = buildLabCreateBody(profile, { language: 'he', amount: 10, webHookUrl: '   ' })
    expect(body.WebHookUrl).toBeUndefined()
  })
})

describe('buildLabCreateBody — JValidateType', () => {
  it('includes JValidateType for CreateTokenOnly', () => {
    const { body } = buildLabCreateBody(profile, {
      language: 'he',
      amount: 10,
      operation: 'CreateTokenOnly',
      jValidateType: 'J2',
    })
    expect(body.AdvancedDefinition).toEqual({ JValidateType: 'J2' })
  })

  it('accepts J5 too', () => {
    const { body } = buildLabCreateBody(profile, {
      language: 'he',
      amount: 10,
      operation: 'CreateTokenOnly',
      jValidateType: 'J5',
    })
    expect(body.AdvancedDefinition).toEqual({ JValidateType: 'J5' })
  })

  it('ignores an invalid JValidateType', () => {
    const { body } = buildLabCreateBody(profile, {
      language: 'he',
      amount: 10,
      operation: 'CreateTokenOnly',
      jValidateType: 'J9',
    })
    expect(body.AdvancedDefinition).toBeUndefined()
  })

  it('is scoped to CreateTokenOnly — ignored for ChargeAndCreateToken', () => {
    const { body } = buildLabCreateBody(profile, {
      language: 'he',
      amount: 10,
      operation: 'ChargeAndCreateToken',
      jValidateType: 'J2',
    })
    expect(body.AdvancedDefinition).toBeUndefined()
  })

  it('is scoped to CreateTokenOnly — ignored for plain ChargeOnly', () => {
    const { body } = buildLabCreateBody(profile, { language: 'he', amount: 10, jValidateType: 'J2' })
    expect(body.AdvancedDefinition).toBeUndefined()
  })
})

describe('buildTokenChargeBody', () => {
  it('requires a token', () => {
    expect(() => buildTokenChargeBody(profile, { amount: 10 })).toThrow('token is required')
  })

  it('requires a positive amount', () => {
    expect(() => buildTokenChargeBody(profile, { token: 'abc' })).toThrow(
      'amount must be a number greater than 0',
    )
    expect(() => buildTokenChargeBody(profile, { token: 'abc', amount: 0 })).toThrow(
      'amount must be a number greater than 0',
    )
  })

  it('builds the minimum schema-permitted body', () => {
    const body = buildTokenChargeBody(profile, { token: 'abc-123', amount: 20.5 })
    expect(body).toEqual({
      TerminalNumber: profile.terminalNumber,
      ApiName: profile.apiName,
      Amount: 20.5,
      Token: 'abc-123',
    })
  })

  it('includes ExternalUniqTranId, CardExpirationMMYY, CVV2 only when provided', () => {
    const body = buildTokenChargeBody(profile, {
      token: 'abc-123',
      amount: 20.5,
      externalUniqTranId: 'lab-1',
      cardExpirationMMYY: '1225',
      cvv2: '123',
    })
    expect(body.ExternalUniqTranId).toBe('lab-1')
    expect(body.CardExpirationMMYY).toBe('1225')
    expect(body.CVV2).toBe('123')
  })

  it('never accepts or forwards a raw card number', () => {
    const body = buildTokenChargeBody(profile, {
      token: 'abc-123',
      amount: 20.5,
      cardNumber: '4580280000000008',
    })
    expect('CardNumber' in body).toBe(false)
  })
})
