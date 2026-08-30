import { useEffect, useId } from 'react'
import type { AgentPickerItem } from '../utils/agentMention'

interface AgentPickerProps {
  open: boolean
  items: AgentPickerItem[]
  selectedIndex: number
  query: string
  top: number
  left: number
  onSelect: (item: AgentPickerItem) => void
}

export function AgentPicker({
  open,
  items,
  selectedIndex,
  query,
  top,
  left,
  onSelect,
}: AgentPickerProps) {
  const listboxId = useId()
  const activeOptionId =
    open && items.length > 0 ? `${listboxId}-option-${selectedIndex}` : undefined

  useEffect(() => {
    if (!open || !activeOptionId) return
    const active = document.getElementById(activeOptionId)
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeOptionId, items.length, open, selectedIndex])

  if (!open) return null

  return (
    <div
      className="agent-picker"
      style={{ top, left }}
      role="dialog"
      aria-label="Agents"
      aria-busy={items.length === 0 ? true : undefined}
    >
      <div className="agent-picker-header">
        <span className="agent-picker-title">Agents</span>
        {query ? <span className="agent-picker-query">@{query}</span> : null}
      </div>

      {items.length === 0 ? (
        <p className="agent-picker-empty" role="status">
          No agents match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div
          className="agent-picker-list"
          role="listbox"
          id={listboxId}
          aria-activedescendant={activeOptionId}
        >
          {items.map((item, index) => {
            const active = index === selectedIndex
            const { agent } = item

            return (
              <button
                key={agent.id}
                type="button"
                id={`${listboxId}-option-${index}`}
                className={`agent-picker-item ${active ? 'active' : ''}`}
                role="option"
                aria-selected={active}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(item)
                }}
              >
                <span className="agent-picker-icon" aria-hidden="true">
                  @
                </span>
                <span className="agent-picker-body">
                  <span className="agent-picker-label">{agent.name}</span>
                  <span className="agent-picker-description">{agent.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="agent-picker-hint" aria-hidden="true">
        ↑↓ navigate · Enter pick · type query · Ctrl+Enter run
      </div>
    </div>
  )
}
