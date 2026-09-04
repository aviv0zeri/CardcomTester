// Catch-all Vercel function behind the /spectra-api/* rewrite (see
// vercel.json). All actual logic lives in server/spectraProxy.js, shared
// with its test suite -- this file only wires env vars into it, matching the
// existing api/*.js convention of thin wrappers over server/*.js modules.
const { createSpectraProxyHandler } = require('../../server/spectraProxy')

module.exports = createSpectraProxyHandler()
