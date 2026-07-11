import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { randomBytes } from 'node:crypto'
import { transcribe } from './stt'
import { cleanup } from './cleanup'
import { ensureWav16k } from './transcode'
import { PWA_HTML } from './bridgePage'
import type { ScribeStore } from './db'
import type { WritingStyle } from '@shared/types'

/**
 * LAN bridge (Phase 6, mobile-adaptive): a phone on the same Wi-Fi opens
 * http://<pc-ip>:<port>/?t=<token> and dictates through THIS PC's local
 * models. Privacy posture: off by default; bearer-token required; audio
 * travels only across the user's own network to their own machine; nothing
 * touches the internet.
 */

let server: Server | null = null

export function bridgeUrl(store: ScribeStore): string | null {
  const s = store.getSettings()
  if (!s.bridgeEnabled || s.bridgeToken === null) return null
  const ip = lanAddress()
  return ip === null ? null : `http://${ip}:${s.bridgePort}/?t=${s.bridgeToken}`
}

export function lanAddress(): string | null {
  for (const [, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) return a.address
    }
  }
  return null
}

export function ensureBridgeToken(store: ScribeStore): string {
  const s = store.getSettings()
  if (s.bridgeToken !== null) return s.bridgeToken
  const token = randomBytes(8).toString('hex')
  store.setSettings({ bridgeToken: token })
  return token
}

export function startBridge(store: ScribeStore): void {
  stopBridge()
  const settings = store.getSettings()
  const testMode = process.env['SCRIBE_TEST_BRIDGE'] === '1'
  if (!settings.bridgeEnabled && !testMode) return
  const token = testMode ? 'test-token' : ensureBridgeToken(store)

  server = createServer((req, res) => {
    void handle(req, res, store, token).catch((err: unknown) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : 'internal error' })
    })
  })
  server.listen(settings.bridgePort, '0.0.0.0', () => {
    console.log(`[bridge] listening on ${bridgeUrl(store) ?? `port ${settings.bridgePort}`}`)
  })
  server.on('error', (err) => console.error('[bridge] server error:', err))
}

export function stopBridge(): void {
  server?.close()
  server = null
}

function authorized(req: IncomingMessage, token: string): boolean {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.searchParams.get('t') === token) return true
  return req.headers.authorization === `Bearer ${token}`
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  store: ScribeStore,
  token: string
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x')

  if (!authorized(req, token)) {
    sendJson(res, 401, { error: 'missing or bad token' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(PWA_HTML)
    return
  }

  if (req.method === 'POST' && url.pathname === '/dictate') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const uploaded = Buffer.concat(chunks)
    if (uploaded.byteLength < 100) {
      sendJson(res, 400, { error: 'empty audio' })
      return
    }
    // The web page sends a ready 16 kHz WAV; the mobile app sends compressed
    // audio (.m4a). Normalize either to the WAV Whisper needs, locally.
    let wav: Buffer
    try {
      wav = await ensureWav16k(uploaded)
    } catch (err) {
      sendJson(res, 415, { error: err instanceof Error ? err.message : 'could not decode audio' })
      return
    }
    const settings = store.getSettings()
    const dictionary = store.getDictionary()
    const styleParam = url.searchParams.get('style')
    const style: WritingStyle = ['professional', 'casual', 'messaging', 'concise'].includes(styleParam ?? '')
      ? (styleParam as WritingStyle)
      : settings.style
    const stt = await transcribe(wav, settings.sttModel, dictionary)
    const clean =
      settings.cleanupEnabled && stt.text.length > 0
        ? await cleanup({ rawTranscript: stt.text, dictionary, style, model: settings.cleanupModel })
        : stt.text
    if (settings.saveHistory && stt.text.length > 0) store.addHistory(stt.text, clean, style, stt.engineMs)
    sendJson(res, 200, { raw: stt.text, clean })
    return
  }

  sendJson(res, 404, { error: 'not found' })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
