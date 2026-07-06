import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DictionaryTerm } from '@shared/types'
import type { FixtureFile } from '../fixtureSchema'
import { checkFixture } from '../fixtureSchema'
import { cleanup, ollamaAvailable } from '../../src/main/cleanup'

const MODEL = process.env['SCRIBE_CLEANUP_MODEL'] ?? 'qwen3:4b-instruct'

const file = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'cleanup-fixtures.json'), 'utf-8')
) as FixtureFile

function toDictionary(fixture: { dictionary: { term: string; hint: string }[] | [] }): DictionaryTerm[] {
  return fixture.dictionary.map((d, i) => ({
    id: i + 1,
    term: d.term,
    hint: d.hint,
    source: 'manual' as const,
    createdAt: new Date().toISOString()
  }))
}

describe(`cleanup contract (live, model=${MODEL})`, () => {
  beforeAll(async () => {
    expect(await ollamaAvailable(), 'Ollama must be running for the live suite').toBe(true)
  })

  for (const fixture of file.fixtures) {
    it(`${fixture.id} — ${fixture.description}`, async () => {
      const output = await cleanup({
        rawTranscript: fixture.input,
        dictionary: toDictionary(fixture),
        style: fixture.style,
        model: MODEL
      })
      expect(output, 'cleanup must not fall back to the raw transcript').not.toBe(fixture.input)
      const failures = checkFixture(fixture, output)
      expect(failures, `output was:\n${output}\n\nfailures:\n${failures.join('\n')}`).toEqual([])
    })
  }
})
