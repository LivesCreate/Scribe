import { execFile } from 'node:child_process'
import { writeFile, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import ffmpegStatic from 'ffmpeg-static'

/**
 * Audio normalization for the phone bridge. The desktop mic path already hands
 * Whisper a 16 kHz mono WAV, but the mobile app records compressed audio
 * (.m4a/AAC) — Whisper only reads PCM WAV. So the PC transcodes anything that
 * isn't already a WAV, locally via a bundled ffmpeg. Audio still never leaves
 * the user's network; ffmpeg runs on their own machine.
 */

/** True if the buffer is already a RIFF/WAVE container (skip transcoding). */
export function isWav(buf: Buffer): boolean {
  return (
    buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WAVE'
  )
}

/** Resolves the bundled ffmpeg binary, rewriting the asar path when packaged. */
function ffmpegBinary(): string {
  if (ffmpegStatic === null) throw new Error('Bundled ffmpeg is missing.')
  // In a packaged app the binary lives in app.asar.unpacked, not inside the
  // read-only asar archive (see electron-builder.yml asarUnpack).
  return ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
}

/** Transcodes arbitrary audio bytes to a 16 kHz mono WAV buffer for Whisper. */
export async function toWav16k(input: Buffer): Promise<Buffer> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const inPath = join(app.getPath('temp'), `scribe-in-${stamp}`)
  const outPath = join(app.getPath('temp'), `scribe-out-${stamp}.wav`)
  await writeFile(inPath, input)
  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpegBinary(),
        ['-y', '-i', inPath, '-ac', '1', '-ar', '16000', '-f', 'wav', outPath],
        { timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
        (err, _stdout, stderr) => {
          if (err) reject(new Error(`ffmpeg failed: ${stderr.slice(0, 300) || err.message}`))
          else resolve()
        }
      )
    })
    return await readFile(outPath)
  } finally {
    void unlink(inPath).catch(() => undefined)
    void unlink(outPath).catch(() => undefined)
  }
}

/** Returns a Whisper-ready WAV: passes real WAVs through, transcodes the rest. */
export async function ensureWav16k(input: Buffer): Promise<Buffer> {
  return isWav(input) ? input : toWav16k(input)
}
