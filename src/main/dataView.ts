import { app } from 'electron'
import type { DataSnapshot } from '@shared/types'
import type { ScribeStore } from './db'

/**
 * The "Your Data" page's source of truth: everything Scribe stores about
 * the user, gathered in one place. The Code view renders this verbatim
 * (read-only); the Readable view organizes it for humans.
 */
export function buildDataSnapshot(store: ScribeStore): DataSnapshot {
  const s = store.getSettings()
  return {
    aboutYou: s.userProfile,
    settings: {
      ...s,
      cloudApiKey: s.cloudApiKey === null ? '(not set)' : '(saved on this device — hidden here)',
      bridgeToken: s.bridgeToken === null ? '(not set)' : s.bridgeToken
    },
    dictionary: store.getDictionary(),
    history: store.getHistory(100),
    storageBackend: store.backend,
    storagePath: app.getPath('userData')
  }
}

const OLLAMA_URL = 'http://127.0.0.1:11434'

/**
 * Asks the LOCAL model to organize the snapshot into plain-language
 * sections. Purely on-device; the page states which model did the work.
 */
export async function organizeSnapshot(store: ScribeStore): Promise<string> {
  const snap = buildDataSnapshot(store)
  const settings = store.getSettings()
  const compact = {
    aboutYou: snap.aboutYou,
    dictionaryTerms: snap.dictionary.map((d) => ({ term: d.term, shorthand: d.hint, source: d.source })),
    recentDictations: snap.history.slice(0, 25).map((h) => ({ said: h.rawTranscript, wrote: h.cleanText })),
    settingsInPlainWords: {
      writingStyle: snap.settings.style,
      hotkey: snap.settings.holdKeyLabel,
      cleanupModel: snap.settings.cleanupModel,
      historySaved: snap.settings.saveHistory,
      cloudEnabled: snap.settings.cloudEnabled,
      phoneAccessEnabled: snap.settings.bridgeEnabled
    }
  }
  const body = {
    model: settings.cleanupModel,
    stream: false,
    think: false,
    options: { temperature: 0, seed: 42, num_ctx: 8192 },
    messages: [
      {
        role: 'system',
        content: `You organize a dictation app's stored data into a short, friendly report for its owner. Use these exact section headings, each on its own line: "About you", "Your words", "How you dictate", "Your settings". Under each, write 1-4 short plain-English lines summarizing ONLY what is in the data — never invent, never guess, never add advice. If a section has no data, write "Nothing here yet." Output plain text only.\n/no_think`
      },
      { role: 'user', content: JSON.stringify(compact) }
    ]
  }
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000)
    })
    const data = (await res.json()) as { message?: { content?: string } }
    const text = data.message?.content?.trim() ?? ''
    return text.length > 0 ? text : fallbackReport(snap)
  } catch {
    return fallbackReport(snap)
  }
}

/** Deterministic report used when the local model is not available. */
function fallbackReport(snap: DataSnapshot): string {
  const lines: string[] = []
  lines.push('About you')
  lines.push(snap.aboutYou.length > 0 ? snap.aboutYou : 'Nothing here yet.')
  lines.push('')
  lines.push('Your words')
  lines.push(
    snap.dictionary.length === 0
      ? 'Nothing here yet.'
      : snap.dictionary.map((d) => (d.hint !== null && d.hint.length > 0 ? `${d.term} (say "${d.hint}")` : d.term)).join(', ')
  )
  lines.push('')
  lines.push('How you dictate')
  lines.push(
    snap.history.length === 0
      ? 'Nothing here yet.'
      : `${snap.history.length} saved dictation${snap.history.length === 1 ? '' : 's'} on this device.`
  )
  lines.push('')
  lines.push('Your settings')
  lines.push(
    `Style: ${snap.settings.style}. Hotkey: ${snap.settings.holdKeyLabel}. History saved: ${snap.settings.saveHistory ? 'yes' : 'no'}. Cloud: ${snap.settings.cloudEnabled ? 'on' : 'off'}. Phone access: ${snap.settings.bridgeEnabled ? 'on' : 'off'}.`
  )
  return lines.join('\n')
}
