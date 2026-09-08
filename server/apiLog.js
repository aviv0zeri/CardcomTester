// Detailed, append-only request/response log for manual testing sessions -- built so
// a real testing session's actual API traffic can be handed to Aviv's GPT oracle as
// raw evidence (see EVIDENCE-LOG.md's own "live transaction we ran and cross-checked
// ourselves" standard), not a paraphrase reconstructed from memory afterward.
//
// One JSON object per line (JSONL): easy to tail/grep by hand, and easy for Claude to
// Read back and turn into a REPORT-FOR-GPT-*.md the same way this project already
// writes those. Local file only, deliberately -- never shipped to Vercel's read-only
// filesystem (see appendLogEntry's own try/catch: a write failure here must never
// break the actual proxied request/response it's logging, which is the real feature).

const fs = require('fs')
const path = require('path')

const DEFAULT_LOG_DIR = path.join(__dirname, 'logs')
const DEFAULT_LOG_FILE = 'api-log.jsonl'
// A full Cardcom "site unavailable" HTML placeholder (the one this session actually
// hit) is a few KB -- long enough to be worth capturing, short enough this cap still
// keeps one entry readable. Truncated, not dropped.
const MAX_BODY_CHARS = 4000

function logFilePath(dir = DEFAULT_LOG_DIR, file = DEFAULT_LOG_FILE) {
  return path.join(dir, file)
}

function truncate(value) {
  if (typeof value !== 'string') return value
  return value.length > MAX_BODY_CHARS ? `${value.slice(0, MAX_BODY_CHARS)}…[truncated]` : value
}

function appendLogEntry(entry, dir = DEFAULT_LOG_DIR, file = DEFAULT_LOG_FILE) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(logFilePath(dir, file), `${JSON.stringify(entry)}\n`)
  } catch (cause) {
    // Diagnostics must never take down the feature they're diagnosing -- surface
    // once to stderr instead of throwing, so a broken log doesn't go unnoticed
    // forever but also never turns into a 500 for the actual caller.
    console.error('apiLog: failed to write log entry', cause)
  }
}

module.exports = {
  appendLogEntry,
  logFilePath,
  truncate,
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILE,
  MAX_BODY_CHARS,
}
