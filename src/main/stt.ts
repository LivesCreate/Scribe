import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { DictionaryTerm } from '@shared/types'
import { shorthandOf } from './cleanupPrompt'

export interface SttResult {
  text: string
  engineMs: number
}

/** Locations searched for the whisper.cpp sidecar, in preference order. */
function whisperDirCandidates(): string[] {
  return [
    join(process.resourcesPath ?? '', 'whisper'),
    join(app.getAppPath(), 'resources', 'whisper'),
    join(app.getAppPath(), '..', '..', 'resources', 'whisper')
  ]
}

interface WhisperInstall {
  exe: string
  variant: 'cuda' | 'cpu'
}

let cached: WhisperInstall | null = null

/**
 * Finds the whisper.cpp executable. Prefers the CUDA build (RTX GPUs);
 * falls back to the CPU build. Release zips name the binary either
 * whisper-cli.exe (new) or main.exe (old), in the zip root or Release/.
 */
export function findWhisper(): WhisperInstall | null {
  if (cached) return cached
  const exeNames = ['whisper-cli.exe', 'main.exe']
  for (const dir of whisperDirCandidates()) {
    for (const variant of ['cuda', 'cpu'] as const) {
      for (const sub of ['', 'Release']) {
        for (const exe of exeNames) {
          const p = join(dir, variant, sub, exe)
          if (existsSync(p)) {
            cached = { exe: p, variant }
            return cached
          }
        }
      }
    }
  }
  return null
}

export function findModel(name: string): string | null {
  const candidates = [
    join(app.getPath('userData'), 'models', `ggml-${name}.bin`),
    join(app.getAppPath(), 'models', `ggml-${name}.bin`),
    join(app.getAppPath(), '..', '..', 'models', `ggml-${name}.bin`)
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

/**
 * Transcribes a 16 kHz mono WAV with the whisper.cpp sidecar.
 * Dictionary terms are biased into decoding via --prompt, which primes
 * the model toward the user's invented words and names.
 */
export async function transcribe(
  wav: Buffer,
  modelName: string,
  dictionary: DictionaryTerm[]
): Promise<SttResult> {
  const install = findWhisper()
  if (!install) throw new Error('Speech engine not found. Run the model setup in Settings.')
  const model = findModel(modelName)
  if (!model) throw new Error(`Speech model "${modelName}" is not downloaded yet.`)

  const tmp = join(app.getPath('temp'), `scribe-${Date.now()}.wav`)
  await writeFile(tmp, wav)

  const args = ['-m', model, '-f', tmp, '-l', 'en', '-nt', '-np', '--no-gpu']
  if (install.variant === 'cuda') args.pop() // keep GPU on for the CUDA build
  if (dictionary.length > 0) {
    // Bias decoding toward the user's words AND their spoken shorthands so
    // an alias like "ToF" comes out spellable instead of a phonetic guess.
    const glossary = dictionary.flatMap((d) => {
      const alias = shorthandOf(d)
      return alias === null ? [d.term] : [d.term, alias]
    })
    args.push('--prompt', `Glossary: ${glossary.join(', ')}.`)
  }

  const started = Date.now()
  try {
    const text = await new Promise<string>((resolve, reject) => {
      execFile(
        install.exe,
        args,
        { timeout: 120_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
        (err, stdout, stderr) => {
          if (err) reject(new Error(`whisper failed: ${stderr.slice(0, 400) || err.message}`))
          else resolve(stdout)
        }
      )
    })
    return { text: normalizeTranscript(text), engineMs: Date.now() - started }
  } finally {
    void unlink(tmp).catch(() => undefined)
  }
}

/** Collapses whisper stdout into a single clean transcript string. */
export function normalizeTranscript(raw: string): string {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
