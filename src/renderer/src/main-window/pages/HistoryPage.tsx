import { useEffect, useState } from 'react'
import type { HistoryEntry } from '@shared/types'

export function HistoryPage(): React.JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const refresh = (): void => {
    void window.scribe.getHistory(100).then(setEntries)
  }
  useEffect(refresh, [])

  const saveEdit = async (id: number): Promise<void> => {
    const { learned } = await window.scribe.updateHistoryEntry(id, draft)
    setEditingId(null)
    refresh()
    if (learned.length > 0) {
      setToast(`Learned: ${learned.join(', ')} — added to your dictionary`)
      setTimeout(() => setToast(null), 5000)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your past dictations, stored only on this device. Fix a misspelled word here and Scribe
        learns it for next time.
      </p>

      {toast !== null && (
        <div
          role="status"
          className="mt-4 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {toast}
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {entries.length === 0 && <li className="text-sm text-zinc-500 dark:text-zinc-400">Nothing yet.</li>}
        {entries.map((h) => (
          <li key={h.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>{new Date(h.createdAt + 'Z').toLocaleString()}</span>
              <span>·</span>
              <span>{h.style}</span>
              <span>·</span>
              <span>{(h.durationMs / 1000).toFixed(1)}s</span>
              <span className="flex-1" />
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(h.cleanText)
                }}
                className="rounded px-2 py-1 font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Copy
              </button>
              <button
                onClick={() => {
                  setEditingId(h.id)
                  setDraft(h.cleanText)
                }}
                className="rounded px-2 py-1 font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Edit
              </button>
            </div>
            {editingId === h.id ? (
              <div className="mt-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Edit dictation text"
                  className="h-28 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void saveEdit(h.id)}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{h.cleanText}</pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
