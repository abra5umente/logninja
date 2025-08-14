import React from 'react'
import { AIRLOCK_FIELDS } from '../lib/airlockSummary'

export default function AirlockSummary({ data, collapsed, setCollapsed, onFilterText }: {
  data: Record<(typeof AIRLOCK_FIELDS)[number], string>
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  onFilterText: (text: string, useRegex?: boolean) => void
}) {
  return (
    <div className="border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 rounded-md overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between border-b border-blue-200/70 dark:border-blue-900/50">
        <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">Airlock Debug Summary</div>
        <button className="text-xs text-blue-700 dark:text-blue-300 hover:underline" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!collapsed && (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-blue-900/80 dark:text-blue-200">
                <th className="px-3 py-2 w-56">Key</th>
                <th className="px-3 py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {AIRLOCK_FIELDS.map((k) => {
                const v = data[k]
                const clickable = v && v !== '—'
                return (
                  <tr key={k} className="border-t border-blue-200/60 dark:border-blue-900/40">
                    <td className="px-3 py-2 text-blue-900 dark:text-blue-100 align-top">{k}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {clickable ? (
                        <button
                          className="underline decoration-dotted hover:decoration-solid text-left"
                          onClick={() => {
                          const token = getAirlockFieldSearchString(k, data)
                          // Flip regex mode when token is clearly a regex or for known regex-only fields
                          const regexByKey = k === 'Proxy Configured' || k === 'Execution Count' || k === 'Top Executed File'
                          const looksRegex = /^\(\?i\)/.test(token) || /[.*+?^${}()|[\]\\]/.test(token)
                          const useRegex = regexByKey || looksRegex
                          if (token) onFilterText(token, useRegex)
                          }}
                          title="Filter main table to matching lines"
                        >
                          {v}
                        </button>
                      ) : (
                        v || '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { getAirlockFieldSearchString } from '../lib/airlockSummary'
