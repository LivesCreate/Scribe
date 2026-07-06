import type { DictionaryTerm, WritingStyle } from '@shared/types'
import { buildSystemPrompt, buildUserPrompt, sanitizeModelOutput } from './cleanupPrompt'

/**
 * Opt-in BYOK cloud cleanup (free tiers, user-supplied keys). Privacy
 * posture: ONLY the transcript text is sent — audio never leaves the
 * device. Callers must surface a visible "sent to <provider>" notice
 * whenever this path runs (spec: per-use-visible, off by default).
 */

export interface CloudCleanupInput {
  rawTranscript: string
  dictionary: DictionaryTerm[]
  style: WritingStyle
  provider: 'groq' | 'gemini'
  apiKey: string
}

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const GEMINI_MODEL = 'gemini-2.5-flash'

export async function cleanupViaCloud(input: CloudCleanupInput): Promise<string> {
  const system = buildSystemPrompt(input.style, input.dictionary)
  const user = buildUserPrompt(input.rawTranscript)
  const text =
    input.provider === 'groq'
      ? await callGroq(system, user, input.apiKey, 60_000)
      : await callGemini(system, user, input.apiKey, 60_000)
  const cleaned = sanitizeModelOutput(text)
  if (cleaned.length === 0) throw new Error('Cloud cleanup returned empty output')
  return cleaned
}

export interface CloudRefineInput {
  /** Text already cleaned by the local model. */
  localText: string
  dictionary: DictionaryTerm[]
  provider: 'groq' | 'gemini'
  apiKey: string
  /** Hard cap so the double-check never makes dictation feel slow. */
  timeoutMs: number
}

/**
 * Second-pass proofread: a stronger cloud model checks the LOCAL model's
 * output and fixes only what's still wrong, without rewriting style or
 * changing meaning. Time-boxed; callers keep the local text if it throws.
 */
export async function refineViaCloud(input: CloudRefineInput): Promise<string> {
  const glossary =
    input.dictionary.length === 0
      ? ''
      : ` Keep these terms exactly as written: ${input.dictionary.map((d) => `"${d.term}"`).join(', ')}.`
  const system = `You are a meticulous proofreader. The text below was already cleaned from a voice dictation. Fix ONLY remaining mistakes in grammar, spelling, punctuation, and capitalization. Do NOT rewrite it in a different style, do NOT add or remove content, and do NOT reformat lists that are already correct. If it is already correct, return it unchanged.${glossary} Output ONLY the corrected text — no preamble, no explanation, no quotes.`
  const text =
    input.provider === 'groq'
      ? await callGroq(system, input.localText, input.apiKey, input.timeoutMs)
      : await callGemini(system, input.localText, input.apiKey, input.timeoutMs)
  const cleaned = sanitizeModelOutput(text)
  return cleaned.length === 0 ? input.localText : cleaned
}

async function callGroq(system: string, user: string, apiKey: string, timeoutMs: number): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    }),
    signal: AbortSignal.timeout(timeoutMs)
  })
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(`Groq: ${data.error?.message ?? res.statusText}`)
  const content = data.choices?.[0]?.message?.content
  if (content === undefined) throw new Error('Groq: empty response')
  return content
}

async function callGemini(system: string, user: string, apiKey: string, timeoutMs: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0 }
    }),
    signal: AbortSignal.timeout(timeoutMs)
  })
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(`Gemini: ${data.error?.message ?? res.statusText}`)
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
  if (content === undefined || content.length === 0) throw new Error('Gemini: empty response')
  return content
}
