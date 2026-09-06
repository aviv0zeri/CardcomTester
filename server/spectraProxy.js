// Same-origin proxy: CardcomTester's browser code never talks to
// payments.avivozeri.com directly and never sees its credential. The browser
// calls /spectra-api/<path> on CardcomTester's own origin; this handler
// forwards that request to spectra-payments with a server-side Bearer
// credential it constructs itself. Transport/auth plumbing only -- no
// payment-domain behavior belongs here (see app.main in spectra-payments for
// that).
//
// Security boundary: the browser controls path/query/body (whatever
// spectraClient.ts already sends) plus one routing hint -- the
// X-Spectra-Profile header, which selects WHICH server-side credential this
// request uses -- and NOTHING else. The upstream base URL and the
// Authorization header are always built from server-side configuration (env
// vars), never from anything on the incoming request -- in particular, an
// incoming Authorization header is never read, so there is nothing for a
// hostile one to override. A caller cannot use X-Spectra-Profile to reach
// another project's data either: it only picks which credential is sent,
// and spectra-payments itself independently rejects any request whose body
// project_id doesn't match that credential's own project_id (403). Picking
// the "wrong" profile here just gets that same 403 back, never a leak.

const DEFAULT_BASE_URL = 'https://payments.avivozeri.com'
const ALLOWED_METHODS = new Set(['GET', 'POST'])
// The one profile that keeps using the original, unrenamed env var --
// existing deployments need no changes for GateOpen to keep working.
const DEFAULT_PROFILE_ID = 'gateopen'

// Every other profile's token lives in its own env var, derived from the
// profile id: cardcom-tester -> SPECTRA_PAYMENTS_API_TOKEN_CARDCOM_TESTER.
function envVarForProfile(profileId) {
  return `SPECTRA_PAYMENTS_API_TOKEN_${profileId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
}

function buildUpstreamPath(query) {
  // `path` is the regex-captured sub-path from vercel.json's rewrite
  // (/spectra-api/(.*) -> /api/spectra-proxy?path=$1) -- a single string,
  // e.g. "customers/27deaf53-...". Re-split and re-encode per segment
  // rather than trusting it verbatim, matching how every other query value
  // here is handled.
  const rawPath = (query && query.path) || ''
  const segments = Array.isArray(rawPath)
    ? rawPath
    : String(rawPath).split('/').filter(Boolean)
  const pathPart = '/' + segments.map(encodeURIComponent).join('/')

  const rest = { ...query }
  delete rest.path
  const qs = new URLSearchParams(rest).toString()
  return qs ? `${pathPart}?${qs}` : pathPart
}

function createSpectraProxyHandler(options = {}) {
  const baseUrl = options.baseUrl ?? process.env.SPECTRA_PAYMENTS_API_URL ?? DEFAULT_BASE_URL
  const defaultToken = options.token ?? process.env.SPECTRA_PAYMENTS_API_TOKEN
  const tokensByProfile = options.tokensByProfile ?? {}
  const fetchImpl = options.fetchImpl ?? fetch

  function resolveToken(profileId) {
    if (!profileId || profileId === DEFAULT_PROFILE_ID) return defaultToken
    if (Object.prototype.hasOwnProperty.call(tokensByProfile, profileId)) return tokensByProfile[profileId]
    return process.env[envVarForProfile(profileId)]
  }

  return async function spectraProxyHandler(req, res) {
    if (!ALLOWED_METHODS.has(req.method)) {
      res.status(405).json({ error: 'method not allowed' })
      return
    }

    const profileHeader = req.headers ? req.headers['x-spectra-profile'] : undefined
    const profileId = typeof profileHeader === 'string' ? profileHeader : undefined
    const token = resolveToken(profileId)

    // Fail closed: never make an unauthenticated upstream request, and never
    // fall back to anything the browser supplied.
    if (!token) {
      res.status(500).json({
        error: profileId
          ? `spectra-payments proxy is not configured for profile "${profileId}"`
          : 'spectra-payments proxy is not configured',
      })
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

module.exports = { createSpectraProxyHandler, buildUpstreamPath, DEFAULT_BASE_URL, DEFAULT_PROFILE_ID, envVarForProfile }
