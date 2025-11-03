import React, { useState, useMemo, useEffect, useRef } from 'react'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Build Regex Query
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Instructions */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Build a regex pattern by adding segments. Each segment can be:
            </p>
            <ul className="mt-2 ml-4 text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li><strong>Literal:</strong> Match exact text (auto-escaped)</li>
              <li><strong>Wildcard:</strong> Match anything (.*?)</li>
              <li><strong>Not:</strong> Match anything EXCEPT this value (negative lookahead)</li>
              <li><strong>Custom:</strong> Enter your own regex pattern (⚠️ avoid nested quantifiers like .*.*)</li>
            </ul>
          </div>

          {/* Segments List */}
          <div className="space-y-2 mb-4">
            {segments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                No segments yet. Click "Add Segment" to start building your pattern.
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
            <button
              onClick={() => addSegment('literal')}
              className="px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
            >
              + Literal
            </button>
            <button
              onClick={() => addSegment('wildcard')}
              className="px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 rounded hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
            >
              + Wildcard
            </button>
            <button
              onClick={() => addSegment('not')}
              className="px-3 py-1.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100 rounded hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
            >
              + Not
            </button>
            <button
              onClick={() => addSegment('custom')}
              className="px-3 py-1.5 text-xs bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 rounded hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
            >
              + Custom
            </button>
          </div>

          {/* Preview */}
          <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Generated Regex
              </label>
              <button
                onClick={copyToClipboard}
                disabled={!generatedRegex}
                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
            <code className="block p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
              {generatedRegex || <span className="text-gray-400 dark:text-gray-500">No pattern yet</span>}
            </code>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!generatedRegex || hasErrors}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            title={hasErrors ? 'Fix validation errors before applying' : undefined}
          >
            Apply to Search
          </button>
        </div>
      </div>
    </div>
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

  const typeColors: Record<SegmentType, string> = {
    literal: 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800',
    wildcard: 'bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 border-purple-200 dark:border-purple-800',
    not: 'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800',
    custom: 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800',
  }

  return (
    <div className={`border rounded-md p-3 ${typeColors[segment.type]}`}>
      <div className="flex items-start gap-2">
        {/* Order Controls */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-0.5 text-xs hover:bg-black/10 dark:hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-0.5 text-xs hover:bg-black/10 dark:hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            ▼
          </button>
        </div>

        {/* Segment Number */}
        <div className="flex-shrink-0 w-6 text-xs font-semibold opacity-60">
          #{index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type Selector */}
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs font-semibold">Type:</label>
            <select
              ref={focusRef}
              value={segment.type}
              onChange={(e) => onUpdate({ type: e.target.value as SegmentType })}
              className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="literal">Literal</option>
              <option value="wildcard">Wildcard</option>
              <option value="not">Not</option>
              <option value="custom">Custom</option>
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
                className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Description */}
          <div className="text-xs opacity-75">
            {segment.type === 'literal' && 'Matches exact text (special characters auto-escaped)'}
            {segment.type === 'wildcard' && 'Matches any text (.*?)'}
            {segment.type === 'not' && `Matches anything EXCEPT "${segment.value}"`}
            {segment.type === 'custom' && 'Custom regex pattern (no escaping)'}
          </div>

          {/* Validation Error */}
          {!validation.valid && (
            <div className="mt-1 text-xs text-red-700 dark:text-red-300 font-semibold">
              ⚠ {validation.error}
            </div>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="flex-shrink-0 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
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
