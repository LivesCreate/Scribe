import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy'
import type { ServerConfig, WritingStyle } from './config'

export interface DictateResult {
  raw: string
  clean: string
}

/**
 * Sends a recording to the user's PC bridge (`POST /dictate`) and returns the
 * transcribed + cleaned text. The recording file (an .m4a from expo-audio) is
 * streamed as the raw request body via BINARY_CONTENT — the reliable way to
 * post file bytes on Android — and the PC transcodes it to 16 kHz WAV before
 * Whisper. Bearer token authorizes the request, matching src/main/bridge.ts.
 */
export async function dictate(
  config: ServerConfig,
  fileUri: string,
  style: WritingStyle
): Promise<DictateResult> {
  const url = `http://${config.host}:${config.port}/dictate?t=${encodeURIComponent(
    config.token
  )}&style=${style}`

  let res: { status: number; body: string }
  try {
    res = await uploadAsync(url, fileUri, {
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'content-type': 'application/octet-stream',
        authorization: `Bearer ${config.token}`
      }
    })
  } catch {
    throw new Error(
      `Could not reach ${config.host}:${config.port}. Check the address and that phone access is on in Scribe.`
    )
  }

  let data: Partial<DictateResult> & { error?: string }
  try {
    data = JSON.parse(res.body) as Partial<DictateResult> & { error?: string }
  } catch {
    throw new Error(`Unexpected response from your PC (status ${res.status}).`)
  }
  if (res.status >= 400 || typeof data.error === 'string') {
    throw new Error(data.error ?? `Your PC returned an error (${res.status}).`)
  }
  return { raw: data.raw ?? '', clean: data.clean ?? '' }
}

/** Cheap liveness check so the UI can tell "wrong address" from "empty speech". */
export async function ping(config: ServerConfig, timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(
      `http://${config.host}:${config.port}/?t=${encodeURIComponent(config.token)}`,
      { method: 'GET', signal: controller.signal }
    )
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
