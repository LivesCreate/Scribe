import { describe, expect, it } from 'vitest'
import { stripAbandonedNaming } from '../src/main/cleanup'

describe('stripAbandonedNaming', () => {
  it('removes an abandoned naming clause and resumes cleanly', () => {
    const input =
      'After that, I went to a place called, uh, what’s it called? Oh yeah, I came back home and played on Steam.'
    expect(stripAbandonedNaming(input)).toBe('After that, I came back home and played on Steam.')
  })

  it('handles the straight-apostrophe / lowercase variant', () => {
    const input = "after that I went to a place called uh what's it called oh yeah I came back home"
    // No sentence punctuation to split on, but the clause is gone.
    expect(stripAbandonedNaming(input)).toBe('After that I came back home')
  })

  it('removes an "I forget" abandonment with a lead-in', () => {
    const input = 'I visited a spot called um I forget the name so I just went home.'
    expect(stripAbandonedNaming(input)).toBe('So I just went home.')
  })

  it('NEVER touches a completed "called <Name>" clause', () => {
    const input = 'First, I went to the store called Bob’s Playground and it was fun.'
    expect(stripAbandonedNaming(input)).toBe(input)
  })

  it('leaves ordinary text untouched', () => {
    const input = 'I called my mom and then we made dinner.'
    expect(stripAbandonedNaming(input)).toBe(input)
  })

  it('does not fire on "a game called" followed by a real title', () => {
    const input = 'I played a game called Geometry Dash for an hour.'
    expect(stripAbandonedNaming(input)).toBe(input)
  })
})
