import type { ScribeStateMachine } from '@shared/stateMachine'
import type { ScribeStore } from './db'
import { transcribe } from './stt'
import { insertAtCursor } from './insert'
import { applyDictionaryShorthand, cleanup, postProcess } from './cleanup'
import { refineViaCloud } from './cloud'

export interface PipelineInput {
  wav: Buffer
  store: ScribeStore
  machine: ScribeStateMachine
  startedAt: number
  onTranscript: (raw: string, clean: string) => void
}

/** WAV -> whisper.cpp transcript -> cleanup LLM -> insert at cursor. */
export async function runPipeline(input: PipelineInput): Promise<void> {
  const { wav, store, machine, startedAt, onTranscript } = input
  try {
    machine.transition('thinking')
    const settings = store.getSettings()
    const dictionary = store.getDictionary()

    const stt = await transcribe(wav, settings.sttModel, dictionary)
    const raw = stt.text
    if (raw.length === 0 || /^[\s[(]*(blank_audio|silence|inaudible)/i.test(raw)) {
      machine.transition('error', 'No speech detected.')
      return
    }

    let clean: string
    if (!settings.cleanupEnabled) {
      clean = applyDictionaryShorthand(raw, dictionary)
    } else {
      // Stage 1 — always run the fast local cleanup (the product).
      clean = await cleanup({ rawTranscript: raw, dictionary, style: settings.style, model: settings.cleanupModel })

      // Stage 2 — optional cloud double-check: a stronger model proofreads
      // the local result and fixes anything it missed. Time-boxed so it can
      // never make dictation feel slow; on timeout or error, keep stage 1.
      if (settings.cloudEnabled && settings.cloudProvider !== null && settings.cloudApiKey !== null) {
        // Per-use-visible notice: the overlay shows exactly where text is going.
        machine.transition('thinking', `Double-checking with ${settings.cloudProvider} (cloud)…`)
        try {
          clean = postProcess(
            await refineViaCloud({
              localText: clean,
              dictionary,
              provider: settings.cloudProvider,
              apiKey: settings.cloudApiKey,
              timeoutMs: 8000
            }),
            settings.style,
            dictionary
          )
        } catch (err) {
          console.error('[pipeline] cloud double-check skipped:', err instanceof Error ? err.message : err)
        }
      }
    }

    machine.transition('inserting')
    await insertAtCursor(clean)

    const durationMs = Date.now() - startedAt
    if (settings.saveHistory) store.addHistory(raw, clean, settings.style, durationMs)
    onTranscript(raw, clean)
    machine.transition('done')
  } catch (err) {
    machine.transition('error', err instanceof Error ? err.message : String(err))
  }
}
