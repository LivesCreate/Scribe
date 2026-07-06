import { useEffect, useState } from 'react'
import type { DictionaryTerm } from '@shared/types'

export function DictionaryPage(): React.JSX.Element {
  const [terms, setTerms] = useState<DictionaryTerm[]>([])
  const [newTerm, setNewTerm] = useState('')
  const [newHint, setNewHint] = useState('')

  const refresh = (): void => {
    void window.scribe.getDictionary().then(setTerms)
  }
  useEffect(refresh, [])

  const add = async (): Promise<void> => {
    const term = newTerm.trim()
    if (term.length === 0) return
    await window.scribe.addDictionaryTerm(term, newHint.trim() || null)
    setNewTerm('')
    setNewHint('')
    refresh()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Personal dictionary</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Teach Scribe your invented words, names, and jargon — exactly how you spell them. Add a
        shorthand and you can just say it (&quot;ToF&quot;) to get the full phrase (&quot;Tide of
        Fortune&quot;). Words you correct in History are added automatically.
      </p>

      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium">Word or phrase</span>
          <input
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder="e.g. Tide of Fortune"
            className="w-52 rounded-lg border border-zinc-300 bg-white px-3 py-2 focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium">Shorthand (optional)</span>
          <input
            value={newHint}
            onChange={(e) => setNewHint(e.target.value)}
            placeholder='e.g. ToF — say this, get the full phrase'
            className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
        >
          Add
        </button>
      </form>

      <ul className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {terms.length === 0 && (
          <li className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No words yet.</li>
        )}
        {terms.map((t) => (
          <li key={t.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <span className="font-medium">{t.term}</span>
              {t.hint !== null && t.hint.length > 0 && (
                <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {t.source === 'manual' && !t.hint.includes(' ') ? `say “${t.hint}”` : t.hint}
                </span>
              )}
            </div>
            {t.source === 'auto-correction' && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                learned
              </span>
            )}
            <button
              onClick={() => {
                void window.scribe.removeDictionaryTerm(t.id).then(refresh)
              }}
              aria-label={`Remove ${t.term}`}
              className="rounded p-1 text-zinc-400 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
