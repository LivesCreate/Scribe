import { describe, expect, it } from 'vitest'
import { extractCorrections } from '../src/main/corrections'

describe('extractCorrections', () => {
  it('detects a spelling correction of an invented word', () => {
    const out = extractCorrections(
      'I added Glimwik to the harbor shop.',
      'I added Glimwick to the harbor shop.'
    )
    expect(out).toEqual([{ term: 'Glimwick', replaced: 'Glimwik' }])
  })

  it('detects a casing correction', () => {
    const out = extractCorrections(
      'We are shipping tide of Fortune next week.',
      'We are shipping Tide of Fortune next week.'
    )
    expect(out.map((c) => c.term)).toContain('Tide')
  })

  it('ignores stopword and grammar edits', () => {
    const out = extractCorrections('I went to a store.', 'I went to the store.')
    expect(out).toEqual([])
  })

  it('ignores wholesale rewrites', () => {
    const out = extractCorrections(
      'Send the invoice on Friday.',
      'Completely different sentence altogether here.'
    )
    expect(out).toEqual([])
  })

  it('detects a correction at the end of the text', () => {
    const out = extractCorrections('The game is called Skybound.', 'The game is called Skybond.')
    expect(out).toEqual([{ term: 'Skybond', replaced: 'Skybound' }])
  })

  it('returns empty when texts are identical', () => {
    expect(extractCorrections('Same text.', 'Same text.')).toEqual([])
  })
})
