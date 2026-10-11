import React from 'react'
import { AIRLOCK_FIELDS, AIRLOCK_FIELD_GROUPS, getAirlockFieldSearchString } from '../lib/airlockSummary'

export default function AirlockSummary({ data, collapsed, setCollapsed, onFilterText }: {
  data: Record<(typeof AIRLOCK_FIELDS)[number], string>
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  onFilterText: (text: string, useRegex?: boolean) => void
}) {
  return (
    <div className="airlock-summary">
      <div className="airlock-summary-header">
        <div className="airlock-summary-title">Airlock Debug Summary</div>
        <button className="airlock-summary-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!collapsed && (
        <div className="overflow-auto">
          <table className="airlock-summary-table">
            <thead>
              <tr className="airlock-summary-thead">
                <th className="px-3 py-2 w-56">Key</th>
                <th className="px-3 py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {AIRLOCK_FIELD_GROUPS.map((group) => (
                <React.Fragment key={group.title}>
                  <tr className="airlock-summary-group">
                    <td colSpan={2}>{group.title}</td>
                  </tr>
                  {group.fields.map((k) => {
                    const v = data[k]
                    const token = v && v !== '—' ? getAirlockFieldSearchString(k, data) : ''
                    return (
                      <tr key={k} className="airlock-summary-row">
                        <td className="airlock-summary-key">{k}</td>
                        <td className="airlock-summary-value">
                          {token ? (
                            <button
                              className="airlock-summary-clickable"
                              onClick={() => {
                                // Flip regex mode when token is clearly a regex or for known regex-only fields
                                const regexByKey = k === 'Proxy Configured' || k === 'Execution Count' || k === 'Top Executed File'
                                const looksRegex = /^\(\?i\)/.test(token) || /[.*+?^${}()|[\]\\]/.test(token)
                                onFilterText(token, regexByKey || looksRegex)
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
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
