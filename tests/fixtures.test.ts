import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FixtureFile } from './fixtureSchema'
import { checkFixture } from './fixtureSchema'

const file = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'cleanup-fixtures.json'), 'utf-8')
) as FixtureFile

describe('cleanup fixture file', () => {
  it('loads and has at least 10 fixtures', () => {
    expect(file.version).toBe(1)
    expect(file.fixtures.length).toBeGreaterThanOrEqual(10)
  })

  it('covers every required category', () => {
    const categories = new Set(file.fixtures.map((f) => f.category))
    for (const required of ['list-detection', 'filler-removal', 'backtrack', 'punctuation', 'dictionary', 'structure', 'style', 'fidelity']) {
      expect(categories, `missing category ${required}`).toContain(required)
    }
  })

  it('every fixture is well-formed', () => {
    const ids = new Set<string>()
    for (const f of file.fixtures) {
      expect(f.id.length, `fixture missing id`).toBeGreaterThan(0)
      expect(ids.has(f.id), `duplicate id ${f.id}`).toBe(false)
      ids.add(f.id)
      expect(f.input.length, `${f.id}: empty input`).toBeGreaterThan(0)
      if (f.match === 'exact') {
        expect(f.expected, `${f.id}: exact fixture needs expected`).toBeTruthy()
      } else {
        expect(f.criteria, `${f.id}: criteria fixture needs criteria`).toBeTruthy()
      }
    }
  })

  it('includes the signature grocery-list test', () => {
    const sig = file.fixtures.find((f) => f.id === 'signature-grocery-list')
    expect(sig).toBeTruthy()
    expect(sig?.match).toBe('exact')
    expect(sig?.expected).toContain('1. Milk')
    expect(sig?.expected).toContain('And then after that')
  })

  it('checkFixture validates the signature expected output against itself', () => {
    const sig = file.fixtures.find((f) => f.id === 'signature-grocery-list')
    expect(sig).toBeTruthy()
    if (!sig?.expected) throw new Error('unreachable')
    expect(checkFixture(sig, sig.expected)).toEqual([])
  })

  it('checkFixture catches a raw-transcript failure (the banned outcome)', () => {
    const filler = file.fixtures.find((f) => f.id === 'filler-heavy')
    expect(filler).toBeTruthy()
    if (!filler) throw new Error('unreachable')
    const rawFailure = checkFixture(filler, filler.input)
    expect(rawFailure.length).toBeGreaterThan(0)
  })
})
