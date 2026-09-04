// Same-origin proxy: CardcomTester's browser code never talks to
// payments.avivozeri.com directly and never sees its credential. The browser
// calls /spectra-api/<path> on CardcomTester's own origin; this handler
// forwards that request to spectra-payments with a server-side Bearer
// credential it constructs itself. Transport/auth plumbing only -- no
// payment-domain behavior belongs here (see app.main in spectra-payments for
// that).
//
// Security boundary: the browser controls path/query/body (whatever
// spectraClient.ts already sends), and NOTHING else. The upstream base URL
// and the Authorization header are always built from server-side
// configuration (env vars), never from anything on the incoming request --
// in particular, an incoming Authorization header is never read, so there is
// nothing for a hostile one to override.

const DEFAULT_BASE_URL = 'https://payments.avivozeri.com'
const ALLOWED_METHODS = new Set(['GET', 'POST'])

function buildUpstreamPath(query) {
  const rawPath = query && query.path
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : []
  const pathPart = '/' + segments.map(encodeURIComponent).join('/')

  const rest = { ...query }
  delete rest.path
  const qs = new URLSearchParams(rest).toString()
  return qs ? `${pathPart}?${qs}` : pathPart
}

function createSpectraProxyHandler(options = {}) {
  const baseUrl = options.baseUrl ?? process.env.SPECTRA_PAYMENTS_API_URL ?? DEFAULT_BASE_URL
  const token = options.token ?? process.env.SPECTRA_PAYMENTS_API_TOKEN
  const fetchImpl = options.fetchImpl ?? fetch

  return async function spectraProxyHandler(req, res) {
    if (!ALLOWED_METHODS.has(req.method)) {
      res.status(405).json({ error: 'method not allowed' })
      return
    }

    // Fail closed: never make an unauthenticated upstream request, and never
    // fall back to anything the browser supplied.
    if (!token) {
      res.status(500).json({ error: 'spectra-payments proxy is not configured' })
      return
    }

    const upstreamUrl = `${baseUrl}${buildUpstreamPath(req.query)}`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
    const init = { method: req.method, headers }
    if (req.method === 'POST') {
      init.body = JSON.stringify(req.body ?? {})
    }

    let upstreamResponse
    try {
      upstreamResponse = await fetchImpl(upstreamUrl, init)
    } catch {
      res.status(502).json({ error: 'spectra-payments request failed' })
      return
    }

    const text = await upstreamResponse.text()
    res.status(upstreamResponse.status)
    try {
      res.json(text ? JSON.parse(text) : {})
    } catch {
      res.setHeader('Content-Type', 'text/plain')
      res.send(text)
    }
  }
}

module.exports = { createSpectraProxyHandler, buildUpstreamPath, DEFAULT_BASE_URL }
