import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCardcomSession } from './createSession'

function mockFetchOnce(body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ text: () => Promise.resolve(body) }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createCardcomSession', () => {
  it('resolves with the checkout Url on ResponseCode 0', async () => {
    mockFetchOnce(JSON.stringify({ ResponseCode: 0, Url: 'https://secure.cardcom.solutions/x' }))
    await expect(createCardcomSession('he')).resolves.toBe('https://secure.cardcom.solutions/x')
  })

  it('accepts a lowercase url field too', async () => {
    mockFetchOnce(JSON.stringify({ ResponseCode: 0, url: 'https://secure.cardcom.solutions/y' }))
    await expect(createCardcomSession('he')).resolves.toBe('https://secure.cardcom.solutions/y')
  })

  it('raises a generic unavailable message for a locked API user (605)', async () => {
    mockFetchOnce(JSON.stringify({ ResponseCode: 605, Description: 'locked' }))
    await expect(createCardcomSession('he')).rejects.toThrow(/server is unavailable/)
  })

  it('raises a generic Cardcom error for any other failing code', async () => {
    mockFetchOnce(JSON.stringify({ ResponseCode: 1, Description: 'something else' }))
    await expect(createCardcomSession('he')).rejects.toThrow('Cardcom error: 1 — something else')
  })

  it('reports the Express-down case when the response is not JSON', async () => {
    mockFetchOnce('<html>not json</html>')
    await expect(createCardcomSession('he')).rejects.toThrow(/Express API is not running/)
  })

  it('treats ResponseCode 0 with no Url as a failure, not a success', async () => {
    mockFetchOnce(JSON.stringify({ ResponseCode: 0 }))
    await expect(createCardcomSession('he')).rejects.toThrow('Cardcom error: 0')
  })
})
