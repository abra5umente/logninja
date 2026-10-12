import React, { useState, useMemo, useEffect, useRef } from 'react'
import Modal from './Modal'
import {
  type RegexSegment,
  type SegmentType,
  createSegment,
  buildRegexFromSegments,
  validateSegment,
} from '../lib/regexBuilder'

interface Props {
  onClose: () => void
  onApply: (regex: string) => void
  initialQuery?: string
}

export default function RegexBuilder({ onClose, onApply, initialQuery = '' }: Props) {
  const [segments, setSegments] = useState<RegexSegment[]>(
    initialQuery ? [createSegment('literal', initialQuery)] : []
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLSelectElement>(null)

  // Memoize expensive regex generation
  const generatedRegex = useMemo(
    () => buildRegexFromSegments(segments),
    [segments]
  )

  // Check if any segments have validation errors
  const hasErrors = useMemo(
    () => segments.some(s => !validateSegment(s).valid),
    [segments]
  )

  // ESC key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus management - focus first input when modal opens
  useEffect(() => {
    if (firstInputRef.current) {
      firstInputRef.current.focus()
    }
  }, [])

  const addSegment = (type: SegmentType = 'literal') => {
    const newSegment = createSegment(type)
    setSegments([...segments, newSegment])
    setEditingId(newSegment.id)
  }

  const updateSegment = (id: string, updates: Partial<RegexSegment>) => {
    setSegments(segments.map(s => (s.id === id ? { ...s, ...updates } : s)))
  }

  const deleteSegment = (id: string) => {
    setSegments(segments.filter(s => s.id !== id))
  }

  const moveSegment = (id: string, direction: 'up' | 'down') => {
    const index = segments.findIndex(s => s.id === id)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === segments.length - 1) return

    const newSegments = [...segments]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSegments[index], newSegments[targetIndex]] = [newSegments[targetIndex], newSegments[index]]
    setSegments(newSegments)
  }

  const handleApply = () => {
    if (!generatedRegex) return
    onApply(generatedRegex)
    onClose()
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedRegex)
  }

  return (
    <Modal onClose={onClose}>
      <div className="popup w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h2 className="font-semibold">
            build regex query
          </h2>
          <button
            onClick={onClose}
            className="btn subtle !p-1.5"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Instructions */}
          <div className="mb-4 p-3 rounded-inner border border-line bg-bg/45 text-xs">
            <p className="text-muted">
              Build a regex pattern by adding segments. Each segment can be:
            </p>
            <ul className="mt-2 ml-4 space-y-1">
              <li><span className="font-semibold text-accent">literal</span> matches exact text (auto-escaped)</li>
              <li><span className="font-semibold text-magenta">wildcard</span> matches anything (.*?)</li>
              <li><span className="font-semibold">not</span> matches anything EXCEPT this value (negative lookahead)</li>
              <li><span className="font-semibold text-cyan">custom</span> is your own regex pattern (avoid nested quantifiers like .*.*)</li>
            </ul>
          </div>

          {/* Segments List */}
          <div className="space-y-2 mb-4">
            {segments.length === 0 ? (
              <div className="empty py-6">
                <span className="kao">(っ˘ω˘ς)</span>
                no segments yet, add one below to start building your pattern
              </div>
            ) : (
              segments.map((segment, index) => (
                <SegmentEditor
                  key={segment.id}
                  segment={segment}
                  index={index}
                  isEditing={editingId === segment.id}
                  onStartEdit={() => setEditingId(segment.id)}
                  onUpdate={(updates) => updateSegment(segment.id, updates)}
                  onDelete={() => deleteSegment(segment.id)}
                  onMoveUp={() => moveSegment(segment.id, 'up')}
                  onMoveDown={() => moveSegment(segment.id, 'down')}
                  canMoveUp={index > 0}
                  canMoveDown={index < segments.length - 1}
                  focusRef={index === 0 ? firstInputRef : undefined}
                />
              ))
            )}
          </div>

          {/* Add Segment Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => addSegment('literal')} className="btn">
              <span className="text-accent">+</span> literal
            </button>
            <button onClick={() => addSegment('wildcard')} className="btn">
              <span className="text-magenta">+</span> wildcard
            </button>
            <button onClick={() => addSegment('not')} className="btn">
              <span className="text-muted">+</span> not
            </button>
            <button onClick={() => addSegment('custom')} className="btn">
              <span className="text-cyan">+</span> custom
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-inner border border-line p-3 bg-bg/45">
            <div className="flex items-center justify-between mb-2">
              <label className="lbl">
                generated regex
              </label>
              <button
                onClick={copyToClipboard}
                disabled={!generatedRegex}
                className="btn !py-1"
                title="Copy to clipboard"
              >
                copy
              </button>
            </div>
            <code className="block p-2 rounded-inner border border-line-strong bg-bg/55 text-accent break-all">
              {generatedRegex || <span className="text-muted">no pattern yet</span>}
            </code>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line">
          <button
            onClick={onClose}
            className="btn subtle"
          >
            cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!generatedRegex || hasErrors}
            className="btn primary"
            title={hasErrors ? 'Fix validation errors before applying' : undefined}
          >
            apply to search
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Segment Editor Component
interface SegmentEditorProps {
  segment: RegexSegment
  index: number
  isEditing: boolean
  onStartEdit: () => void
  onUpdate: (updates: Partial<RegexSegment>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  focusRef?: React.RefObject<HTMLSelectElement>
}

function SegmentEditor({
  segment,
  index,
  isEditing,
  onStartEdit,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  focusRef,
}: SegmentEditorProps) {
  const validation = validateSegment(segment)

  // Coloured left edge per segment type
  const typeColors: Record<SegmentType, string> = {
    literal: 'var(--accent)',
    wildcard: 'var(--magenta)',
    not: 'var(--muted)',
    custom: 'var(--cyan)',
  }

  return (
    <div
      className="border border-line rounded-inner p-3 bg-bg/45"
      style={{ borderLeft: `3px solid ${typeColors[segment.type]}` }}
    >
      <div className="flex items-start gap-2">
        {/* Order Controls */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-0.5 text-[10px] text-muted hover:text-fg rounded-chip disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-0.5 text-[10px] text-muted hover:text-fg rounded-chip disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            ▼
          </button>
        </div>

        {/* Segment Number */}
        <div className="flex-shrink-0 w-6 text-xs font-semibold text-muted tabular-nums">
          #{index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type Selector */}
          <div className="flex items-center gap-2 mb-2">
            <label className="lbl">type</label>
            <select
              ref={focusRef}
              value={segment.type}
              onChange={(e) => onUpdate({ type: e.target.value as SegmentType })}
              className="in !w-auto !py-1 !text-xs"
            >
              <option value="literal">literal</option>
              <option value="wildcard">wildcard</option>
              <option value="not">not</option>
              <option value="custom">custom</option>
            </select>
          </div>

          {/* Value Input */}
          {segment.type !== 'wildcard' && (
            <div className="mb-1">
              <input
                type="text"
                value={segment.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder={
                  segment.type === 'literal'
                    ? 'Enter exact text to match...'
                    : segment.type === 'not'
                    ? 'Enter text to exclude...'
                    : 'Enter regex pattern...'
                }
                className="in"
              />
            </div>
          )}

          {/* Description */}
          <div className="text-[11px] text-muted">
            {segment.type === 'literal' && 'Matches exact text (special characters auto-escaped)'}
            {segment.type === 'wildcard' && 'Matches any text (.*?)'}
            {segment.type === 'not' && `Matches anything EXCEPT "${segment.value}"`}
            {segment.type === 'custom' && 'Custom regex pattern (no escaping)'}
          </div>

          {/* Validation Error */}
          {!validation.valid && (
            <div className="error mt-2 !py-1.5 text-xs">
              <span className="kao">(&gt;﹏&lt;)</span>
              {validation.error}
            </div>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="btn subtle danger !p-1 flex-shrink-0"
          title="Delete segment"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
