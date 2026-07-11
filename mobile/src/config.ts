import * as SecureStore from 'expo-secure-store'

/**
 * Connection to the user's own PC. The phone records; the PC's local models
 * transcribe and clean. Nothing here touches the internet — `host` is a LAN
 * address (later, an end-to-end-encrypted relay id). Stored in the OS secure
 * store because `token` is a bearer secret for the PC bridge.
 */
export interface ServerConfig {
  host: string
  port: string
  token: string
}

export type WritingStyle = 'professional' | 'casual' | 'messaging'

const KEY = 'scribe.server'

export async function loadConfig(): Promise<ServerConfig | null> {
  const raw = await SecureStore.getItemAsync(KEY)
  if (raw === null) return null
  try {
    const c = JSON.parse(raw) as Partial<ServerConfig>
    if (typeof c.host === 'string' && typeof c.port === 'string' && typeof c.token === 'string') {
      return { host: c.host, port: c.port, token: c.token }
    }
  } catch {
    // fall through to null on any corruption
  }
  return null
}

export async function saveConfig(config: ServerConfig): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(config))
}

export async function clearConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY)
}

/**
 * Accepts what a user is likely to type or paste from Scribe's Settings:
 * a bare IP, `host:port`, or a full `http://host:port/?t=token` bridge URL.
 * Returns null if there is nothing usable.
 */
export function parseServerInput(input: string, fallback: ServerConfig | null): ServerConfig | null {
  const text = input.trim()
  if (text.length === 0) return null
  try {
    if (text.startsWith('http://') || text.startsWith('https://')) {
      const u = new URL(text)
      const token = u.searchParams.get('t') ?? fallback?.token ?? ''
      return { host: u.hostname, port: u.port !== '' ? u.port : '8737', token }
    }
  } catch {
    // not a URL — fall through to host[:port] parsing
  }
  const [host, port] = text.split(':')
  if (host === undefined || host.length === 0) return null
  return { host, port: port ?? '8737', token: fallback?.token ?? '' }
}
