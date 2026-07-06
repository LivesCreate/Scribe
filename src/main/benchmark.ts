import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { findModel, findWhisper, transcribe } from './stt'
import type { ScribeStore } from './db'

export interface BenchmarkResult {
  sttMs: number | null
  tier: 'low' | 'mid' | 'high'
  chosenSttModel: string
}

function findSample(): string | null {
  const candidates = [
    join(process.resourcesPath ?? '', 'bench-sample.wav'),
    join(app.getAppPath(), 'resources', 'bench-sample.wav'),
    join(app.getAppPath(), '..', '..', 'resources', 'bench-sample.wav')
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

/**
 * One-time device benchmark (spec: detect the device, pick models, downshift
 * if the latency floor is missed, never assume one machine). Transcribes a
 * bundled ~11 s sample and picks the STT model from measured speed:
 *   < 2.5 s  -> high tier (small.en if present or downloadable later)
 *   < 6 s    -> mid tier (base.en)
 *   else     -> low tier (base.en, and prefer toggle mode UX unaffected)
 */
export async function runFirstRunBenchmark(store: ScribeStore): Promise<BenchmarkResult | null> {
  const settings = store.getSettings()
  if (settings.benchmarked) {
    console.log('[benchmark] already done, skipping')
    return null
  }
  const sample = findSample()
  const whisper = findWhisper()
  if (sample === null || whisper === null || findModel('base.en') === null) return null

  let sttMs: number | null = null
  try {
    const wav = readFileSync(sample)
    const started = Date.now()
    await transcribe(wav, 'base.en', [])
    sttMs = Date.now() - started
  } catch (err) {
    console.error('[benchmark] transcription failed:', err)
    return null
  }

  // Thresholds are generous: an 11 s sample in < 4 s (incl. model load)
  // means real-time-plus headroom, so the bigger model is affordable.
  const tier: BenchmarkResult['tier'] = sttMs < 4000 ? 'high' : sttMs < 8000 ? 'mid' : 'low'
  // small.en is only chosen when the device is fast AND the model is present;
  // otherwise stay on base.en (downloadable upgrade via Settings).
  const chosenSttModel = tier === 'high' && findModel('small.en') !== null ? 'small.en' : 'base.en'
  store.setSettings({ benchmarked: true, sttModel: chosenSttModel })
  console.log(`[benchmark] base.en on 11s sample: ${sttMs} ms -> tier=${tier}, model=${chosenSttModel}`)
  return { sttMs, tier, chosenSttModel }
}
