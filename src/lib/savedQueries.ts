/**
 * Saved builder queries, kept in localStorage so they survive a reload.
 * A tiny store with subscribe() so the builder and the presets dropdown stay
 * in step without lifting the list into App.
 */

import { useSyncExternalStore } from 'react'
import { type BuilderQuery, type QueryTerm, createTerm } from './regexBuilder'

export interface SavedQuery {
  id: string
  name: string
  query: BuilderQuery
  /** The regex the query built when it was saved */
  pattern: string
  updatedAt: number
}

export const STORAGE_KEY = 'logninja.savedQueries'

type StoredTerm = Pick<QueryTerm, 'value' | 'kind'>

function readTerms(raw: unknown): QueryTerm[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is StoredTerm => !!t && typeof t.value === 'string' && (t.kind === 'text' || t.kind === 'regex'))
    .map(t => createTerm(t.value, t.kind))
}

/** Parses stored JSON, dropping anything malformed rather than failing */
export function parseSavedQueries(json: string | null): SavedQuery[] {
  if (!json) return []
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: SavedQuery[] = []
  for (const item of data) {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.pattern !== 'string') continue
    const q = item.query ?? {}
    out.push({
      id: item.id,
      name: item.name,
      pattern: item.pattern,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
      query: {
        mode: q.mode === 'all' ? 'all' : 'any',
        include: readTerms(q.include),
        exclude: readTerms(q.exclude),
      },
    })
  }
  return out
}

export function serializeSavedQueries(list: SavedQuery[]): string {
  const strip = (terms: QueryTerm[]): StoredTerm[] => terms.map(({ value, kind }) => ({ value, kind }))
  return JSON.stringify(list.map(s => ({
    ...s,
    query: { mode: s.query.mode, include: strip(s.query.include), exclude: strip(s.query.exclude) },
  })))
}

let cache: SavedQuery[] | null = null
const listeners = new Set<() => void>()

function load(): SavedQuery[] {
  if (cache) return cache
  try {
    cache = parseSavedQueries(localStorage.getItem(STORAGE_KEY))
  } catch {
    cache = []
  }
  return cache
}

function commit(next: SavedQuery[]) {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, serializeSavedQueries(next))
  } catch {
    // Storage blocked or full: keep the list for this session anyway
  }
  listeners.forEach(l => l())
}

export function getSavedQueries(): SavedQuery[] {
  return load()
}

export function subscribeSavedQueries(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSavedQueries(): SavedQuery[] {
  return useSyncExternalStore(subscribeSavedQueries, getSavedQueries)
}

/** Adds a new saved query, or replaces the one with the same id. Returns its id. */
export function saveQuery(entry: { id?: string; name: string; query: BuilderQuery; pattern: string }): string {
  const list = load()
  const id = entry.id && list.some(s => s.id === entry.id)
    ? entry.id
    : `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const saved: SavedQuery = { id, name: entry.name.trim(), query: entry.query, pattern: entry.pattern, updatedAt: Date.now() }
  const exists = list.some(s => s.id === id)
  commit(exists ? list.map(s => (s.id === id ? saved : s)) : [...list, saved])
  return id
}

export function deleteSavedQuery(id: string) {
  commit(load().filter(s => s.id !== id))
}

/** Cross-tab: pick up changes another LogNinja tab made */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    cache = null
    load()
    listeners.forEach(l => l())
  })
}
