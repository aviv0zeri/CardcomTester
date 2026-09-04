// Behind the /spectra-api/* rewrite (see vercel.json), which captures the
// sub-path as ?path=... via a regex rewrite -- a flat function, not a
// [...path] dynamic route, matching every other function in this directory
// (payment.js, lab-create.js, ...). All actual logic lives in
// server/spectraProxy.js, shared with its test suite.
const { createSpectraProxyHandler } = require('../server/spectraProxy')

module.exports = createSpectraProxyHandler()
