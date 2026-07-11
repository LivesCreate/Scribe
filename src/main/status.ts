import { createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'
import { findModel, findWhisper } from './stt'
import { ollamaAvailable } from './cleanup'

export interface SystemStatus {
  whisperEngine: boolean
  whisperVariant: 'cuda' | 'cpu' | null
  sttModel: boolean
  ollamaRunning: boolean
  cleanupModelReady: boolean
  micPermission: 'unknown' | 'granted' | 'denied'
}

const OLLAMA_URL = 'http://127.0.0.1:11434'

export async function getSystemStatus(sttModelName: string, cleanupModel: string): Promise<SystemStatus> {
  const whisper = findWhisper()
  const ollama = await ollamaAvailable()
  let cleanupReady = false
  if (ollama) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
      const data = (await res.json()) as { models?: { name?: string }[] }
      cleanupReady = (data.models ?? []).some((m) => (m.name ?? '').startsWith(cleanupModel.split(':')[0] ?? ''))
    } catch {
      cleanupReady = false
    }
  }
  return {
    whisperEngine: whisper !== null,
    whisperVariant: whisper?.variant ?? null,
    sttModel: findModel(sttModelName) !== null,
    ollamaRunning: ollama,
    cleanupModelReady: cleanupReady,
    micPermission: 'unknown'
  }
}

/**
 * Downloads a ggml STT model into userData/models with progress callbacks.
 * Models come from the official whisper.cpp Hugging Face mirror.
 */
export async function downloadSttModel(
  name: string,
  onProgress: (pct: number) => void
): Promise<string> {
  const dir = join(app.getPath('userData'), 'models')
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, `ggml-${name}.bin`)
  if (existsSync(dest)) return dest

  // Distil-Whisper models live in their own HF org; everything else ships in
  // the whisper.cpp models repo.
  const url = name.startsWith('distil-')
    ? `https://huggingface.co/distil-whisper/${name}-ggml/resolve/main/ggml-${name}.bin`
    : `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`
  const res = await fetch(url)
  if (!res.ok || res.body === null) throw new Error(`Model download failed: ${res.status}`)
  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0

  const progress = progressTap((chunk: Uint8Array) => {
    received += chunk.byteLength
    if (total > 0) onProgress(Math.round((received / total) * 100))
  })

  await pipeline(
    Readable.fromWeb(res.body as import('node:stream/web').ReadableStream<Uint8Array>),
    progress,
    createWriteStream(`${dest}.part`)
  )
  renameSync(`${dest}.part`, dest)
  onProgress(100)
  return dest
}

function progressTap(onChunk: (c: Uint8Array) => void): Transform {
  return new Transform({
    transform(chunk: Uint8Array, _enc, cb) {
      onChunk(chunk)
      cb(null, chunk)
    }
  })
}
