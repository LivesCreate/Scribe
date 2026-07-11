import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { DictionaryTerm, HistoryEntry, Settings, WritingStyle } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

/**
 * Forward-migrates settings loaded from disk so old saved values keep working
 * after a schema change. Currently: the retired single-tap 'toggle' mode maps
 * to the new 'doubletap' mode (both are "tap the combo" rather than "hold").
 */
function migrateSettings(s: Settings): Settings {
  if ((s.hotkeyMode as string) === 'toggle') s.hotkeyMode = 'doubletap'
  return s
}

export interface ScribeStore {
  readonly backend: 'sqlite' | 'json-fallback'
  getSettings(): Settings
  setSettings(patch: Partial<Settings>): Settings
  getDictionary(): DictionaryTerm[]
  addDictionaryTerm(term: string, hint: string | null, source: DictionaryTerm['source']): DictionaryTerm
  updateDictionaryTerm(id: number, term: string, hint: string | null): DictionaryTerm | null
  removeDictionaryTerm(id: number): void
  addHistory(raw: string, clean: string, style: WritingStyle, durationMs: number): void
  getHistory(limit: number): HistoryEntry[]
  getHistoryEntry(id: number): HistoryEntry | null
  updateHistoryCleanText(id: number, cleanText: string): void
  deleteAllData(): void
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL UNIQUE,
  hint TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_transcript TEXT NOT NULL,
  clean_text TEXT NOT NULL,
  style TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

type SqliteDb = import('better-sqlite3').Database

function openSqlite(dbPath: string): SqliteDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}

class SqliteStore implements ScribeStore {
  readonly backend = 'sqlite' as const
  constructor(private db: SqliteDb) {}

  getSettings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    const stored: Record<string, unknown> = {}
    for (const r of rows) stored[r.key] = JSON.parse(r.value)
    return migrateSettings({ ...DEFAULT_SETTINGS, ...stored } as Settings)
  }

  setSettings(patch: Partial<Settings>): Settings {
    const stmt = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    const tx = this.db.transaction((entries: [string, unknown][]) => {
      for (const [k, v] of entries) stmt.run(k, JSON.stringify(v))
    })
    tx(Object.entries(patch))
    return this.getSettings()
  }

  getDictionary(): DictionaryTerm[] {
    const rows = this.db
      .prepare('SELECT id, term, hint, source, created_at FROM dictionary ORDER BY term COLLATE NOCASE')
      .all() as { id: number; term: string; hint: string | null; source: string; created_at: string }[]
    return rows.map((r) => ({
      id: r.id,
      term: r.term,
      hint: r.hint,
      source: r.source === 'auto-correction' ? 'auto-correction' : 'manual',
      createdAt: r.created_at
    }))
  }

  addDictionaryTerm(term: string, hint: string | null, source: DictionaryTerm['source']): DictionaryTerm {
    const info = this.db
      .prepare(
        'INSERT INTO dictionary (term, hint, source) VALUES (?, ?, ?) ON CONFLICT(term) DO UPDATE SET hint = excluded.hint RETURNING id, term, hint, source, created_at'
      )
      .get(term, hint, source) as { id: number; term: string; hint: string | null; source: string; created_at: string }
    return {
      id: info.id,
      term: info.term,
      hint: info.hint,
      source: info.source === 'auto-correction' ? 'auto-correction' : 'manual',
      createdAt: info.created_at
    }
  }

  updateDictionaryTerm(id: number, term: string, hint: string | null): DictionaryTerm | null {
    const info = this.db
      .prepare('UPDATE dictionary SET term = ?, hint = ? WHERE id = ? RETURNING id, term, hint, source, created_at')
      .get(term, hint, id) as
      | { id: number; term: string; hint: string | null; source: string; created_at: string }
      | undefined
    if (info === undefined) return null
    return {
      id: info.id,
      term: info.term,
      hint: info.hint,
      source: info.source === 'auto-correction' ? 'auto-correction' : 'manual',
      createdAt: info.created_at
    }
  }

  removeDictionaryTerm(id: number): void {
    this.db.prepare('DELETE FROM dictionary WHERE id = ?').run(id)
  }

  addHistory(raw: string, clean: string, style: WritingStyle, durationMs: number): void {
    this.db
      .prepare('INSERT INTO history (raw_transcript, clean_text, style, duration_ms) VALUES (?, ?, ?, ?)')
      .run(raw, clean, style, durationMs)
  }

  getHistory(limit: number): HistoryEntry[] {
    const rows = this.db
      .prepare(
        'SELECT id, raw_transcript, clean_text, style, duration_ms, created_at FROM history ORDER BY id DESC LIMIT ?'
      )
      .all(limit) as {
      id: number
      raw_transcript: string
      clean_text: string
      style: string
      duration_ms: number
      created_at: string
    }[]
    return rows.map((r) => ({
      id: r.id,
      rawTranscript: r.raw_transcript,
      cleanText: r.clean_text,
      style: (['professional', 'casual', 'messaging', 'concise'].includes(r.style) ? r.style : 'professional') as WritingStyle,
      durationMs: r.duration_ms,
      createdAt: r.created_at
    }))
  }

  getHistoryEntry(id: number): HistoryEntry | null {
    const r = this.db
      .prepare('SELECT id, raw_transcript, clean_text, style, duration_ms, created_at FROM history WHERE id = ?')
      .get(id) as
      | { id: number; raw_transcript: string; clean_text: string; style: string; duration_ms: number; created_at: string }
      | undefined
    if (!r) return null
    return {
      id: r.id,
      rawTranscript: r.raw_transcript,
      cleanText: r.clean_text,
      style: (['professional', 'casual', 'messaging', 'concise'].includes(r.style) ? r.style : 'professional') as WritingStyle,
      durationMs: r.duration_ms,
      createdAt: r.created_at
    }
  }

  updateHistoryCleanText(id: number, cleanText: string): void {
    this.db.prepare('UPDATE history SET clean_text = ? WHERE id = ?').run(cleanText, id)
  }

  deleteAllData(): void {
    this.db.exec('DELETE FROM settings; DELETE FROM dictionary; DELETE FROM history;')
  }
}

/**
 * JSON-file fallback used only when the better-sqlite3 prebuilt binary is
 * unavailable for this Electron ABI (documented risk in docs/DECISIONS.md).
 * Same interface, same durability location.
 */
class JsonStore implements ScribeStore {
  readonly backend = 'json-fallback' as const
  private data: {
    settings: Partial<Settings>
    dictionary: DictionaryTerm[]
    history: HistoryEntry[]
    nextId: number
  }

  constructor(private filePath: string) {
    if (existsSync(filePath)) {
      this.data = JSON.parse(readFileSync(filePath, 'utf-8'))
    } else {
      this.data = { settings: {}, dictionary: [], history: [], nextId: 1 }
    }
  }

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data))
  }

  getSettings(): Settings {
    return migrateSettings({ ...DEFAULT_SETTINGS, ...this.data.settings })
  }

  setSettings(patch: Partial<Settings>): Settings {
    this.data.settings = { ...this.data.settings, ...patch }
    this.persist()
    return this.getSettings()
  }

  getDictionary(): DictionaryTerm[] {
    return [...this.data.dictionary].sort((a, b) => a.term.localeCompare(b.term))
  }

  addDictionaryTerm(term: string, hint: string | null, source: DictionaryTerm['source']): DictionaryTerm {
    const existing = this.data.dictionary.find((t) => t.term === term)
    if (existing) {
      existing.hint = hint
      this.persist()
      return existing
    }
    const entry: DictionaryTerm = {
      id: this.data.nextId++,
      term,
      hint,
      source,
      createdAt: new Date().toISOString()
    }
    this.data.dictionary.push(entry)
    this.persist()
    return entry
  }

  updateDictionaryTerm(id: number, term: string, hint: string | null): DictionaryTerm | null {
    const entry = this.data.dictionary.find((t) => t.id === id)
    if (!entry) return null
    entry.term = term
    entry.hint = hint
    this.persist()
    return entry
  }

  removeDictionaryTerm(id: number): void {
    this.data.dictionary = this.data.dictionary.filter((t) => t.id !== id)
    this.persist()
  }

  addHistory(raw: string, clean: string, style: WritingStyle, durationMs: number): void {
    this.data.history.unshift({
      id: this.data.nextId++,
      rawTranscript: raw,
      cleanText: clean,
      style,
      durationMs,
      createdAt: new Date().toISOString()
    })
    this.persist()
  }

  getHistory(limit: number): HistoryEntry[] {
    return this.data.history.slice(0, limit)
  }

  getHistoryEntry(id: number): HistoryEntry | null {
    return this.data.history.find((h) => h.id === id) ?? null
  }

  updateHistoryCleanText(id: number, cleanText: string): void {
    const entry = this.data.history.find((h) => h.id === id)
    if (entry) {
      entry.cleanText = cleanText
      this.persist()
    }
  }

  deleteAllData(): void {
    this.data = { settings: {}, dictionary: [], history: [], nextId: 1 }
    this.persist()
  }
}

export function createStore(): ScribeStore {
  const dir = app.getPath('userData')
  try {
    return new SqliteStore(openSqlite(join(dir, 'scribe.db')))
  } catch (err) {
    console.error('[db] better-sqlite3 unavailable, using JSON fallback:', err)
    return new JsonStore(join(dir, 'scribe-store.json'))
  }
}
