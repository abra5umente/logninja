import React, { useState, useMemo, useEffect, useRef } from 'react'
import Modal from './Modal'
import {
  type BuilderQuery,
  type QueryTerm,
  type TermKind,
  createTerm,
  buildPattern,
  validateTerm,
  cloneQuery,
} from '../lib/regexBuilder'
import { buildSearchRegex } from '../lib/search'
import { useSavedQueries, saveQuery, deleteSavedQuery } from '../lib/savedQueries'
import { levelTextClass } from '../lib/levelColors'
import type { LogEntry } from '../lib/types'

interface Props {
  onClose: () => void
  onApply: (pattern: string, query: BuilderQuery, savedId: string | null) => void
  initialQuery: BuilderQuery
  initialSavedId?: string | null
  /** Loaded entries, for the live preview */
  entries?: LogEntry[]
}

type TermList = 'include' | 'exclude'

const PREVIEW_SAMPLES = 5

export default function RegexBuilder({ onClose, onApply, initialQuery, initialSavedId = null, entries }: Props) {
  const saved = useSavedQueries()
  const [query, setQuery] = useState<BuilderQuery>(() => cloneQuery(initialQuery))
  const [savedId, setSavedId] = useState<string | null>(initialSavedId)
  const [name, setName] = useState(() => saved.find(s => s.id === initialSavedId)?.name ?? '')
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [showRegex, setShowRegex] = useState(false)
  const [copied, setCopied] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const { pattern, error } = useMemo(() => buildPattern(query), [query])
  const openSaved = saved.find(s => s.id === savedId) ?? null

  // Live preview against the loaded lines, using the same matching as the search
  const [preview, setPreview] = useState<{ count: number; samples: LogEntry[] } | null>(null)
  useEffect(() => {
    if (!entries || !pattern) { setPreview(null); return }
    const t = setTimeout(() => {
      const { re } = buildSearchRegex(pattern, true)
      if (!re) { setPreview(null); return }
      const test = new RegExp(re.source, re.flags.replace('g', ''))
      let count = 0
      const samples: LogEntry[] = []
      for (const e of entries) {
        if (test.test(`${e.timeStr} ${e.level} ${e.message}`)) {
          count++
          if (samples.length < PREVIEW_SAMPLES) samples.push(e)
        }
      }
      setPreview({ count, samples })
    }, 200)
    return () => clearTimeout(t)
  }, [pattern, entries])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  // Two-click delete: the first click arms the button, which disarms itself after a few seconds
  useEffect(() => {
    if (!armedDeleteId) return
    const t = setTimeout(() => setArmedDeleteId(null), 3000)
    return () => clearTimeout(t)
  }, [armedDeleteId])

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 1500)
    return () => clearTimeout(t)
  }, [justSaved])

  const updateTerm = (list: TermList, id: string, updates: Partial<QueryTerm>) => {
    setQuery(q => ({ ...q, [list]: q[list].map(t => (t.id === id ? { ...t, ...updates } : t)) }))
  }

  const removeTerm = (list: TermList, id: string) => {
    setQuery(q => ({ ...q, [list]: q[list].filter(t => t.id !== id) }))
  }

  const addTerm = (list: TermList) => {
    setQuery(q => ({ ...q, [list]: [...q[list], createTerm()] }))
  }

  const openSavedQuery = (id: string) => {
    const s = saved.find(x => x.id === id)
    if (!s) return
    setQuery(cloneQuery(s.query))
    setSavedId(s.id)
    setName(s.name)
  }

  const handleDelete = (id: string) => {
    if (armedDeleteId !== id) { setArmedDeleteId(id); return }
    deleteSavedQuery(id)
    setArmedDeleteId(null)
    if (savedId === id) setSavedId(null)
  }

  const canSave = !!pattern && !!name.trim()
  const handleSave = (asNew: boolean) => {
    if (!canSave) return
    const id = saveQuery({ id: asNew ? undefined : savedId ?? undefined, name, query, pattern })
    setSavedId(id)
    setJustSaved(true)
  }

  const handleApply = () => {
    if (!pattern) return
    onApply(pattern, query, savedId)
    onClose()
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pattern).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }).catch(() => {})
  }

  const onTermKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Keep the app's find-mode Enter (next match) from firing too
      e.preventDefault()
      e.stopPropagation()
      handleApply()
    }
  }

  const hasTerms = query.include.length + query.exclude.length > 0
  const nameChanged = !!openSaved && name.trim() !== openSaved.name

  return (
    <Modal onClose={onClose}>
      <div className="popup w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h2 className="font-semibold">build query</h2>
          <button onClick={onClose} className="btn subtle !p-1.5" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Saved queries */}
          {saved.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="lbl">saved queries</span>
              <div className="flex flex-wrap gap-1.5">
                {saved.map(s => (
                  <div
                    key={s.id}
                    className={`inline-flex items-center overflow-hidden rounded-chip border text-xs ${s.id === savedId ? 'border-accent text-accent' : 'border-line-strong'}`}
                  >
                    <button
                      onClick={() => openSavedQuery(s.id)}
                      className="px-2.5 py-1 hover:text-fg"
                      title={`Open "${s.name}" to edit\n${s.pattern}`}
                    >
                      {s.name}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className={`px-1.5 py-1 border-l border-line ${armedDeleteId === s.id ? 'bg-red text-bg' : 'text-muted hover:text-red'}`}
                      title={armedDeleteId === s.id ? 'Click again to delete' : 'Delete saved query'}
                      aria-label={`Delete saved query ${s.name}`}
                    >
                      {armedDeleteId === s.id ? 'delete?' : '×'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wanted terms */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>show lines with</span>
              <div className="seg" role="radiogroup" aria-label="Match any or all terms">
                <button
                  className={query.mode === 'any' ? 'on' : ''}
                  role="radio"
                  aria-checked={query.mode === 'any'}
                  onClick={() => setQuery(q => ({ ...q, mode: 'any' }))}
                  title="A line needs at least one of these"
                >
                  any
                </button>
                <button
                  className={query.mode === 'all' ? 'on' : ''}
                  role="radio"
                  aria-checked={query.mode === 'all'}
                  onClick={() => setQuery(q => ({ ...q, mode: 'all' }))}
                  title="A line needs every one of these, in any order"
                >
                  all
                </button>
              </div>
              <span>of these</span>
            </div>
            {query.include.map((term, i) => (
              <TermRow
                key={term.id}
                term={term}
                placeholder={i === 0 ? 'e.g. error, or C:\\Program Files\\*\\app.exe' : 'another term'}
                inputRef={i === 0 ? firstInputRef : undefined}
                onChange={(u) => updateTerm('include', term.id, u)}
                onRemove={() => removeTerm('include', term.id)}
                onKeyDown={onTermKeyDown}
              />
            ))}
            <div>
              <button onClick={() => addTerm('include')} className="btn !py-1">
                <span className="text-accent">+</span> add term
              </button>
            </div>
          </div>

          {/* Unwanted terms */}
          <div className="flex flex-col gap-2">
            <div className="text-sm">but skip lines with any of these</div>
            {query.exclude.map(term => (
              <TermRow
                key={term.id}
                term={term}
                placeholder="e.g. heartbeat"
                onChange={(u) => updateTerm('exclude', term.id, u)}
                onRemove={() => removeTerm('exclude', term.id)}
                onKeyDown={onTermKeyDown}
              />
            ))}
            <div>
              <button onClick={() => addTerm('exclude')} className="btn !py-1">
                <span className="text-red">−</span> add exclusion
              </button>
            </div>
          </div>

          <p className="text-[11px] text-muted">
            <span className="text-fg">*</span> matches anything on the line, so <span className="text-fg">Program Files\*\app.exe</span> finds
            app.exe in any folder under Program Files. Matching ignores upper and lower case. Switch a term to <span className="text-fg">regex</span> to
            write the pattern yourself. Press Enter to apply.
          </p>

          {/* Preview */}
          <div className="rounded-inner border border-line p-3 bg-bg/45 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="lbl">preview</span>
              {pattern && preview && entries && (
                <span className={`text-xs tabular-nums ${preview.count === 0 ? 'text-yellow' : ''}`}>
                  {preview.count.toLocaleString()} of {entries.length.toLocaleString()} lines match
                </span>
              )}
            </div>
            {error ? (
              <div className="error !py-1.5 text-xs">
                <span className="kao">(&gt;﹏&lt;)</span>
                {error}
              </div>
            ) : !pattern ? (
              <div className="text-xs text-muted">
                {hasTerms ? 'type a term to see what it finds' : 'add a term to start'}
              </div>
            ) : preview && preview.count === 0 ? (
              <div className="text-xs text-muted"><span className="kao">(・_・;)</span> nothing matches in the loaded logs</div>
            ) : preview ? (
              <div className="flex flex-col gap-0.5 text-[11px]">
                {preview.samples.map(e => (
                  <div key={e.index} className="truncate" title={e.message}>
                    <span className="text-muted">{e.timeStr}</span>{' '}
                    <span className={levelTextClass(e.level)}>{e.level}</span>{' '}
                    {e.message}
                  </div>
                ))}
                {preview.count > preview.samples.length && (
                  <div className="text-muted">…and {(preview.count - preview.samples.length).toLocaleString()} more</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted">checking…</div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRegex(s => !s)}
                className="text-[11px] text-muted hover:text-fg"
                aria-expanded={showRegex}
              >
                {showRegex ? '▾' : '▸'} regex
              </button>
              {showRegex && pattern && (
                <button onClick={copyToClipboard} className="btn !py-0.5 !text-[11px]" title="Copy to clipboard">
                  {copied ? 'copied' : 'copy'}
                </button>
              )}
            </div>
            {showRegex && (
              <code className="block p-2 rounded-inner border border-line-strong bg-bg/55 text-accent text-[11px] break-all">
                {pattern || <span className="text-muted">no pattern yet</span>}
              </code>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-line">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleSave(false) } }}
            placeholder="name this query to save it"
            className="in !w-56"
            aria-label="Query name"
          />
          <button
            onClick={() => handleSave(false)}
            disabled={!canSave}
            className="btn"
            title={!pattern ? 'Add a valid term first' : !name.trim() ? 'Give it a name first' : undefined}
          >
            {justSaved ? 'saved ✓' : openSaved ? 'save changes' : 'save'}
          </button>
          {openSaved && (
            <button
              onClick={() => handleSave(true)}
              disabled={!canSave}
              className="btn subtle"
              title={nameChanged ? undefined : 'Tip: change the name first'}
            >
              save as new
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn subtle">cancel</button>
          <button
            onClick={handleApply}
            disabled={!pattern}
            className="btn primary"
            title={error ? 'Fix the highlighted term first' : undefined}
          >
            apply to search
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface TermRowProps {
  term: QueryTerm
  placeholder: string
  inputRef?: React.RefObject<HTMLInputElement>
  onChange: (updates: Partial<QueryTerm>) => void
  onRemove: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

function TermRow({ term, placeholder, inputRef, onChange, onRemove, onKeyDown }: TermRowProps) {
  const validation = validateTerm(term)
  const showError = !validation.valid && term.value.trim() !== ''
  const setKind = (kind: TermKind) => onChange({ kind })

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={term.value}
          onChange={(e) => onChange({ value: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder={term.kind === 'regex' ? 'regex, e.g. timeout|timed out' : placeholder}
          className={`in flex-1 ${showError ? '!border-red' : ''}`}
          spellCheck={false}
        />
        <div className="seg flex-shrink-0" role="radiogroup" aria-label="Term type">
          <button
            className={term.kind === 'text' ? 'on' : ''}
            role="radio"
            aria-checked={term.kind === 'text'}
            onClick={() => setKind('text')}
            title="Match this text (* matches anything)"
          >
            text
          </button>
          <button
            className={term.kind === 'regex' ? 'on' : ''}
            role="radio"
            aria-checked={term.kind === 'regex'}
            onClick={() => setKind('regex')}
            title="Treat this as a regular expression"
          >
            regex
          </button>
        </div>
        <button onClick={onRemove} className="btn subtle danger !p-1 flex-shrink-0" title="Remove" aria-label="Remove term">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
      {showError && <div className="text-[11px] text-red">{validation.error}</div>}
    </div>
  )
}
