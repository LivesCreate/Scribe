import { describe, expect, it } from 'vitest'
import type { DictionaryTerm } from '../src/shared/types'
import { applyDictionaryShorthand } from '../src/main/cleanup'
import { shorthandOf } from '../src/main/cleanupPrompt'

function entry(term: string, hint: string | null, source: DictionaryTerm['source'] = 'manual'): DictionaryTerm {
  return { id: 1, term, hint, source, createdAt: new Date().toISOString() }
}

const tof = entry('Tide of Fortune', 'ToF')

describe('shorthandOf', () => {
  it('accepts a short standalone alias', () => {
    expect(shorthandOf(tof)).toBe('ToF')
  })
  it('rejects free-text hints, auto-corrections, and self-aliases', () => {
    expect(shorthandOf(entry('Tide of Fortune', 'my game — always title case'))).toBeNull()
    expect(shorthandOf(entry('Kubernetes', 'corrected from "cooper netties"', 'auto-correction'))).toBeNull()
    expect(shorthandOf(entry('Scribe', 'scribe'))).toBeNull()
    expect(shorthandOf(entry('Scribe', null))).toBeNull()
  })
})

describe('applyDictionaryShorthand', () => {
  it('expands the alias in any casing', () => {
    expect(applyDictionaryShorthand('I updated ToF today.', [tof])).toBe('I updated Tide of Fortune today.')
    expect(applyDictionaryShorthand('i updated tof today', [tof])).toBe('i updated Tide of Fortune today')
    expect(applyDictionaryShorthand('TOF is my game', [tof])).toBe('Tide of Fortune is my game')
  })
  it('expands letter-separated transcriber renderings', () => {
    expect(applyDictionaryShorthand('I updated T O F today.', [tof])).toBe('I updated Tide of Fortune today.')
    expect(applyDictionaryShorthand('I updated T.O.F. today.', [tof])).toBe('I updated Tide of Fortune today.')
    expect(applyDictionaryShorthand('I updated T-O-F today.', [tof])).toBe('I updated Tide of Fortune today.')
  })
  it('never touches words that merely contain the alias', () => {
    expect(applyDictionaryShorthand('the tofu was great', [tof])).toBe('the tofu was great')
    expect(applyDictionaryShorthand('photof inish', [tof])).toBe('photof inish')
  })
  it('ignores entries without a usable alias', () => {
    const noAlias = entry('Kubernetes', 'corrected from "cooper netties"', 'auto-correction')
    expect(applyDictionaryShorthand('deploy to kubernetes', [noAlias])).toBe('deploy to kubernetes')
  })
  it('handles multiple occurrences and multiple entries', () => {
    const pb = entry('Peanut Butter Blast', 'PBB')
    const text = 'tof and pbb ship together, tof first'
    expect(applyDictionaryShorthand(text, [tof, pb])).toBe(
      'Tide of Fortune and Peanut Butter Blast ship together, Tide of Fortune first'
    )
  })
})
