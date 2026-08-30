import { useEffect, useId } from 'react'
import { EMOJI_PICKER_COLS, type EmojiPickerItem } from '../utils/emojiPicker'

interface EmojiPickerProps {
  open: boolean
  items: EmojiPickerItem[]
  selectedIndex: number
  query: string
  top: number
  left: number
  onSelect: (item: EmojiPickerItem) => void
}

export function EmojiPicker({
  open,
  items,
  selectedIndex,
  query,
  top,
  left,
  onSelect,
}: EmojiPickerProps) {
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
      className="emoji-picker"
      style={{ top, left }}
      role="dialog"
      aria-label="Emoji picker"
      aria-busy={items.length === 0 ? true : undefined}
    >
      <div className="emoji-picker-header">
        <span className="emoji-picker-title">Emoji &amp; reactions</span>
        {query ? <span className="emoji-picker-query">:{query}</span> : null}
      </div>

      {items.length === 0 ? (
        <p className="emoji-picker-empty" role="status">
          No matches for &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div
          className="emoji-picker-grid"
          role="listbox"
          id={listboxId}
          aria-activedescendant={activeOptionId}
        >
          {items.map((item, index) => {
            const active = index === selectedIndex
            return (
              <button
                key={item.id}
                type="button"
                id={`${listboxId}-option-${index}`}
                className={`emoji-picker-item ${active ? 'active' : ''}`}
                role="option"
                aria-selected={active}
                aria-label={`:${item.shortcode}:`}
                title={`:${item.shortcode}:`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(item)
                }}
              >
                {item.type === 'gif' ? (
                  <img className="emoji-picker-gif" src={item.preview} alt="" draggable={false} />
                ) : (
                  <span className="emoji-picker-emoji" aria-hidden="true">
                    {item.preview}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="emoji-picker-hint" aria-hidden="true">
        ↑↓←→ navigate · Enter pick · Esc dismiss · {EMOJI_PICKER_COLS} per row
      </div>
    </div>
  )
}
