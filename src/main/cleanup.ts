import type { DictionaryTerm, WritingStyle } from '@shared/types'
import { buildSystemPrompt, buildUserPrompt, sanitizeModelOutput, shorthandOf } from './cleanupPrompt'

export interface CleanupInput {
  rawTranscript: string
  dictionary: DictionaryTerm[]
  style: WritingStyle
  model: string
}

const OLLAMA_URL = 'http://127.0.0.1:11434'

interface OllamaChatResponse {
  message?: { content?: string }
  error?: string
}

/**
 * The cleanup stage — the heart of the product. Sends the raw transcript
 * plus contract prompt to the local Ollama model. Deterministic: pinned
 * temperature 0 and fixed seed, so same input -> same output.
 */
export async function cleanup(input: CleanupInput): Promise<string> {
  const body = {
    model: input.model,
    stream: false,
    think: false,
    options: { temperature: 0, seed: 42, num_ctx: 4096 },
    messages: [
      { role: 'system', content: buildSystemPrompt(input.style, input.dictionary) },
      { role: 'user', content: buildUserPrompt(input.rawTranscript) }
    ]
  }

  let res: Response
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      // Warm calls are ~1s; the generous cap only covers a cold model load
      // on first use, after which cleanup is near-instant.
      signal: AbortSignal.timeout(30_000)
    })
  } catch {
    // Ollama not running/installed: degrade gracefully to the raw transcript
    // rather than losing the user's words.
    console.error('[cleanup] Ollama unreachable; inserting raw transcript')
    return applyDictionaryShorthand(input.rawTranscript, input.dictionary)
  }

  const data = (await res.json()) as OllamaChatResponse
  if (!res.ok || data.error !== undefined || data.message?.content === undefined) {
    console.error('[cleanup] Ollama error:', data.error ?? res.statusText)
    return applyDictionaryShorthand(input.rawTranscript, input.dictionary)
  }
  const cleaned = postProcess(sanitizeModelOutput(data.message.content), input.style, input.dictionary)
  return cleaned.length > 0 ? cleaned : applyDictionaryShorthand(input.rawTranscript, input.dictionary)
}

/**
 * The deterministic repairs applied to EVERY cleanup output regardless of
 * which model produced it (local or cloud) — model quirks are fixed in
 * code, not by prompt whack-a-mole.
 */
export function postProcess(text: string, style: WritingStyle, dictionary: DictionaryTerm[]): string {
  return applyDictionaryShorthand(
    stripAbandonedNaming(applyStyleRules(normalizeListMarkers(text), style)),
    dictionary
  )
}

/**
 * Deterministic backstop for the ABANDONED CLAUSES rule: if the model still
 * left an unfinished naming clause — a "<det> <noun> called/named" that is
 * followed by uncertainty filler ("uh", "what's it called?", "I forget")
 * instead of an actual name — remove the whole clause up to the resume.
 *
 * The required uncertainty marker is the safety guard: a completed clause
 * like "the store called Bob's Playground" has a name (capitalized) right
 * after "called" and no filler, so it never matches.
 */
export function stripAbandonedNaming(text: string): string {
  // Structure: optional "I went to " lead-in, a determiner+noun, "called/named",
  // weak separators, then a REQUIRED uncertainty marker, then any run of filler
  // (incl. "oh yeah" and the interrogative) up to the real resumed content.
  // The required marker is the guard: "the store called Bob's Playground" has a
  // name right after "called" and no marker, so it never matches.
  // Apostrophes vary (straight ' vs curly ’); accept either everywhere.
  const ap = "['’]?"
  const strong =
    `uh+|um+|er+|erm+|what${ap}s\\s+it\\s+(?:called|named)|i\\s+(?:forget|don${ap}t\\s+remember|can${ap}t\\s+remember)(?:\\s+(?:the\\s+name|what\\s+it${ap}s\\s+called))?`
  const filler = `${strong}|oh|yeah`
  const re = new RegExp(
    `\\b(?:I\\s+(?:went\\s+to|was\\s+at|visited)\\s+)?(?:a|an|the|this|that|some)\\s+[a-z]+\\s+(?:called|named)\\b[\\s,?]*(?:${strong})(?:[\\s,?]|${filler})*`,
    'gi'
  )
  const stripped = text.replace(re, '')
  if (stripped === text) return text // nothing abandoned — leave lists/prose untouched
  // Tidy only the seam left by the removal; [^\S\n] preserves list newlines.
  return stripped
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/[^\S\n]+([,.!?])/g, '$1')
    .replace(/,(?=[^\S\n]*[.!?])/g, '')
    .replace(/(^|[.!?][^\S\n]+)([a-z])/g, (_m, p, c: string) => p + c.toUpperCase())
    .trim()
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10
}

/**
 * Deterministic repair for a model quirk: list items rendered as
 * "One: Milk" / "First: Milk" instead of "1. Milk". A line that starts
 * with a spelled number + colon is unambiguously a mis-marked list item.
 */
export function normalizeListMarkers(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*)(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth):\s+(.*)$/i)
      if (!m) return line
      const n = NUMBER_WORDS[(m[2] as string).toLowerCase()]
      if (n === undefined) return line
      const rest = m[3] as string
      return `${m[1] ?? ''}${n}. ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`
    })
    .join('\n')
}

/**
 * Deterministic style post-processing for rules the model applies
 * inconsistently. Messaging style never ends in a bare period.
 */
export function applyStyleRules(text: string, style: CleanupInput['style']): string {
  if (style === 'messaging') return text.replace(/\.\s*$/, '')
  return text
}

/**
 * Deterministic dictionary shorthand: a manual term whose hint is a short
 * spoken alias ("ToF" for "Tide of Fortune") is expanded wherever the alias
 * survived into the text — whether the transcriber wrote "ToF", "tof",
 * "T O F", or "T.O.F.". Backstops the prompt rule so expansion never
 * depends on the model's mood.
 */
export function applyDictionaryShorthand(text: string, dictionary: DictionaryTerm[]): string {
  let out = text
  for (const entry of dictionary) {
    const alias = shorthandOf(entry)
    if (alias === null) continue
    const escaped = alias.split('').map(escapeRegex)
    const patterns = [escaped.join('')]
    // Letter-by-letter variants for acronym-like aliases: "T O F", "T.O.F.",
    // "T-O-F" — common speech-to-text renderings of a spoken abbreviation.
    if (alias.length >= 2 && alias.length <= 6 && /^[a-z0-9]+$/i.test(alias)) {
      patterns.push(escaped.join('[ .-]') + '\\.?')
    }
    for (const p of patterns) {
      out = out.replace(new RegExp(`(?<![\\w])${p}(?![\\w])`, 'gi'), entry.term)
    }
  }
  return out
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Names of models installed in the local Ollama, or [] when unreachable. */
export async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    const data = (await res.json()) as { models?: { name?: string }[] }
    return (data.models ?? []).map((m) => m.name ?? '').filter((n) => n.length > 0)
  } catch {
    return []
  }
}

/**
 * Fire-and-forget warmup: loads the cleanup model into VRAM at app start so
 * the first real dictation doesn't pay the cold-load cost. Safe to ignore
 * failures — if Ollama isn't up, the first cleanup just loads it then.
 */
export function warmUpCleanupModel(model: string): void {
  void fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: '30m',
      options: { num_predict: 1 },
      messages: [{ role: 'user', content: 'hi' }]
    }),
    signal: AbortSignal.timeout(60_000)
  }).catch(() => undefined)
}

/** True if a local Ollama server is answering. */
export async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
