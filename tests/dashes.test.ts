import { describe, it, expect } from 'vitest'
import { stripDashes, stripDanglingOrdinal } from '../src/main/cleanup'

describe('stripDashes — Wispr-style no-dash punctuation', () => {
  it('turns a spaced em dash into a sentence break', () => {
    expect(stripDashes('The plan is ready — we can ship it')).toBe('The plan is ready. We can ship it')
  })

  it('handles a tight em dash', () => {
    expect(stripDashes('wait—no, cancel that')).toBe('wait. No, cancel that')
  })

  it('converts a spaced hyphen used as a dash', () => {
    expect(stripDashes('I was tired - so I left')).toBe('I was tired. So I left')
  })

  it('leaves hyphenated words alone', () => {
    expect(stripDashes('it was a well-known fact')).toBe('it was a well-known fact')
  })

  it('leaves bullet-list markers alone', () => {
    expect(stripDashes('For the trip:\n- Passport\n- Sunscreen')).toBe('For the trip:\n- Passport\n- Sunscreen')
  })

  it('leaves a tight en-dash numeric range alone', () => {
    expect(stripDashes('pages 3–5')).toBe('pages 3–5')
  })

  it('leaves clean text untouched', () => {
    expect(stripDashes('Bought milk, eggs, and bread. The store was busy.')).toBe(
      'Bought milk, eggs, and bread. The store was busy.'
    )
  })
})

describe('stripDanglingOrdinal — drop a trailed-off enumeration marker', () => {
  it('drops a dangling ordinal on its own trailing line', () => {
    expect(stripDanglingOrdinal('1. Do this\n2. Do that\n\nThird.')).toBe('1. Do this\n2. Do that')
  })

  it('drops a dangling ordinal at the end of a sentence run', () => {
    expect(stripDanglingOrdinal('I want the button to work. Third.')).toBe('I want the button to work.')
  })

  it('drops "and finally" with nothing after it', () => {
    expect(stripDanglingOrdinal('Set up the desks. And finally')).toBe('Set up the desks.')
  })

  it('never touches a legitimate mid-sentence ordinal', () => {
    expect(stripDanglingOrdinal('I ranked third.')).toBe('I ranked third.')
    expect(stripDanglingOrdinal('She came in first.')).toBe('She came in first.')
  })

  it('keeps a real ordinal list item', () => {
    expect(stripDanglingOrdinal('First, buy milk.\nSecond, buy eggs.')).toBe(
      'First, buy milk.\nSecond, buy eggs.'
    )
  })
})
