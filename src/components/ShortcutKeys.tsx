import { parseShortcutKeys } from '../utils/shortcutDisplay'

interface ShortcutKeysProps {
  keys: string
  className?: string
}

export function ShortcutKeys({ keys, className }: ShortcutKeysProps) {
  const chords = parseShortcutKeys(keys)

  return (
    <span className={className ? `shortcut-keys ${className}` : 'shortcut-keys'}>
      {chords.map((chord, chordIndex) => (
        <span key={`${chord.keys.join('-')}-${chordIndex}`} className="shortcut-keys-chord">
          {chord.joinWith === 'then' && <span className="shortcut-keys-then">then</span>}
          {chord.joinWith === 'or' && <span className="shortcut-keys-or">/</span>}
          {chord.keys.map((key, keyIndex) => (
            <kbd key={`${key}-${keyIndex}`} className="shortcut-keys-kbd">
              {key}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  )
}
