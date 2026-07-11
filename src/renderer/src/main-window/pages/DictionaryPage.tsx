import { useEffect, useState } from 'react'
import type { DictionaryTerm } from '@shared/types'
import { Button, Card, Kbd, PageTitle } from '../ui'

/**
 * A hint counts as a spoken shorthand when it's a short single token
 * ("ToF" for "Tide of Fortune") — the same rule the cleanup engine uses in
 * cleanupPrompt.ts. Longer, spaced hints are treated as plain notes.
 */
function isShorthand(t: DictionaryTerm): boolean {
  if (t.source !== 'manual') return false
  const h = t.hint?.trim() ?? ''
  return h.length > 0 && h.length <= 24 && !h.includes(' ') && h.toLowerCase() !== t.term.toLowerCase()
}

const inputCls =
  'rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-zinc-500 focus:outline-none'

export function DictionaryPage(): React.JSX.Element {
  const [terms, setTerms] = useState<DictionaryTerm[]>([])
  const [newTerm, setNewTerm] = useState('')
  const [newHint, setNewHint] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editHint, setEditHint] = useState('')

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

  const startEdit = (t: DictionaryTerm): void => {
    setEditingId(t.id)
    setEditTerm(t.term)
    setEditHint(isShorthand(t) ? (t.hint ?? '') : t.source === 'manual' ? (t.hint ?? '') : '')
  }

  const saveEdit = async (): Promise<void> => {
    if (editingId === null) return
    const term = editTerm.trim()
    if (term.length === 0) return
    await window.scribe.updateDictionaryTerm(editingId, term, editHint.trim() || null)
    setEditingId(null)
    refresh()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Personal dictionary"
        subtitle="Teach Scribe your invented words, names, and jargon — spelled exactly how you want. Optionally give one a spoken shorthand: say the short version, and Scribe writes the full phrase. Words you correct in History are added here automatically."
      />

      <Card className="p-5">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <label className="flex flex-col text-sm">
            <span className="mb-1.5 font-medium text-ink">Word or phrase</span>
            <input
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="e.g. Tide of Fortune"
              className={`w-52 ${inputCls}`}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1.5 font-medium text-ink">Spoken shorthand (optional)</span>
            <input
              value={newHint}
              onChange={(e) => setNewHint(e.target.value)}
              placeholder="e.g. ToF"
              className={`w-52 ${inputCls}`}
            />
          </label>
          <Button type="submit" variant="primary" className="py-2">
            Add
          </Button>
        </form>
        <p className="mt-3 text-xs text-ink-faint">
          Example: word <span className="text-ink-muted">Tide of Fortune</span>, shorthand{' '}
          <span className="text-ink-muted">ToF</span> — then saying &quot;ToF&quot; writes &quot;Tide
          of Fortune.&quot; Leave shorthand blank to just fix the spelling of a word you say normally.
        </p>
      </Card>

      <Card className="divide-y divide-line">
        {terms.length === 0 && <p className="p-5 text-sm text-ink-muted">No words yet.</p>}
        {terms.map((t) =>
          editingId === t.id ? (
            <div key={t.id} className="flex flex-wrap items-end gap-3 p-4">
              <label className="flex flex-col text-sm">
                <span className="mb-1.5 text-xs text-ink-muted">Word or phrase</span>
                <input value={editTerm} onChange={(e) => setEditTerm(e.target.value)} className={`w-52 ${inputCls}`} />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1.5 text-xs text-ink-muted">Spoken shorthand (optional)</span>
                <input
                  value={editHint}
                  onChange={(e) => setEditHint(e.target.value)}
                  placeholder="e.g. ToF"
                  className={`w-52 ${inputCls}`}
                />
              </label>
              <Button variant="primary" className="py-2" onClick={() => void saveEdit()}>
                Save
              </Button>
              <Button className="py-2" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div key={t.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{t.term}</span>
                  {t.source === 'auto-correction' && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      learned
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  {isShorthand(t) ? (
                    <>
                      Say <Kbd>{t.hint}</Kbd> → writes <span className="text-ink">{t.term}</span>
                    </>
                  ) : t.source === 'auto-correction' ? (
                    'Learned from a word you fixed — kept spelled this way.'
                  ) : t.hint !== null && t.hint.length > 0 ? (
                    t.hint
                  ) : (
                    'Always written exactly like this.'
                  )}
                </p>
              </div>
              <button
                onClick={() => startEdit(t)}
                className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                Edit
              </button>
              <button
                onClick={() => void window.scribe.removeDictionaryTerm(t.id).then(refresh)}
                aria-label={`Remove ${t.term}`}
                className="rounded-md px-2 py-1 text-xs font-medium text-ink-faint hover:bg-surface-2 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          )
        )}
      </Card>
    </div>
  )
}
