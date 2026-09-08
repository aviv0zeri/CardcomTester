import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
const { appendLogEntry, logFilePath, truncate, MAX_BODY_CHARS } = require('./apiLog')

let tmpDir

afterEach(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  tmpDir = undefined
})

describe('truncate', () => {
  it('leaves a short string untouched', () => {
    expect(truncate('hello')).toBe('hello')
  })

  it('truncates a string past MAX_BODY_CHARS and marks it', () => {
    const long = 'x'.repeat(MAX_BODY_CHARS + 500)
    const result = truncate(long)
    expect(result.length).toBeLessThan(long.length)
    expect(result).toContain('[truncated]')
  })

  it('passes non-string values through unchanged', () => {
    expect(truncate({ a: 1 })).toEqual({ a: 1 })
    expect(truncate(null)).toBeNull()
  })
})

describe('appendLogEntry', () => {
  it('creates the log directory and appends one JSON line per call', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cardcom-tester-apilog-'))
    const file = 'test.jsonl'
    appendLogEntry({ a: 1 }, tmpDir, file)
    appendLogEntry({ a: 2 }, tmpDir, file)

    const lines = fs.readFileSync(logFilePath(tmpDir, file), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual({ a: 1 })
    expect(JSON.parse(lines[1])).toEqual({ a: 2 })
  })

  it('never throws even if the write itself fails', () => {
    // A file path where the "directory" is actually a file -- mkdirSync/appendFileSync
    // both fail here, and appendLogEntry must swallow that, not propagate it.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cardcom-tester-apilog-'))
    const blockerPath = path.join(tmpDir, 'not-a-directory')
    fs.writeFileSync(blockerPath, 'x')
    expect(() => appendLogEntry({ a: 1 }, blockerPath, 'test.jsonl')).not.toThrow()
  })
})
