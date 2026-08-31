import { useEffect, useId } from 'react'
import {
  groupSlashCommandItems,
  type SlashCommandPickerItem,
} from '../utils/slashCommandPicker'

interface SlashCommandPickerProps {
  open: boolean
  items: SlashCommandPickerItem[]
  selectedIndex: number
  query: string
  top: number
  left: number
  onSelect: (item: SlashCommandPickerItem) => void
  onHighlight: (index: number) => void
}

export function SlashCommandPicker({
  open,
  items,
  selectedIndex,
  query,
  top,
  left,
  onSelect,
  onHighlight,
}: SlashCommandPickerProps) {
  const listboxId = useId()
  const activeOptionId =
    open && items.length > 0 ? `${listboxId}-option-${selectedIndex}` : undefined
  const groups = groupSlashCommandItems(items)

  useEffect(() => {
    if (!open || !activeOptionId) return
    const active = document.getElementById(activeOptionId)
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeOptionId, items.length, open, selectedIndex])

  if (!open) return null

  let itemIndex = -1

  return (
    <div
      className="slash-command-picker"
      style={{ top, left }}
      role="dialog"
      aria-label="Slash commands"
      aria-busy={items.length === 0 ? true : undefined}
    >
      <div className="slash-command-picker-header">
        <span className="slash-command-picker-title">Commands</span>
        {query ? <span className="slash-command-picker-query">/{query}</span> : null}
      </div>

      {items.length === 0 ? (
        <p className="slash-command-picker-empty" role="status">
          No matches for &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div
          className="slash-command-picker-list"
          role="listbox"
          id={listboxId}
          aria-activedescendant={activeOptionId}
        >
          {groups.map((group) => (
            <div key={group.category} className="slash-command-picker-group">
              <div className="slash-command-picker-group-label" aria-hidden="true">
                {group.label}
              </div>
              {group.items.map((item) => {
                itemIndex += 1
                const index = itemIndex
                const active = index === selectedIndex
                const { command } = item

                return (
                  <button
                    key={command.id}
                    type="button"
                    id={`${listboxId}-option-${index}`}
                    tabIndex={-1}
                    className={`slash-command-item ${active ? 'active' : ''}`}
                    role="option"
                    aria-selected={active}
                    onMouseMove={() => {
                      if (index !== selectedIndex) onHighlight(index)
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      onSelect(item)
                    }}
                  >
                    <span className="slash-command-icon" aria-hidden="true">
                      {command.icon}
                    </span>
                    <span className="slash-command-body">
                      <span className="slash-command-label">{command.label}</span>
                      <span className="slash-command-description">{command.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div className="slash-command-picker-hint" aria-hidden="true">
        ↑↓ navigate · Enter pick · Esc dismiss
      </div>
    </div>
  )
}
