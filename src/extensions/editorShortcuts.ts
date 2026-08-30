import { Extension } from '@tiptap/core'

export const EditorShortcuts = Extension.create({
  name: 'editorShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
      'Mod-Alt-1': () => this.editor.commands.toggleHeading({ level: 1 }),
      'Mod-Alt-2': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Alt-3': () => this.editor.commands.toggleHeading({ level: 3 }),
      'Mod-Shift-h': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Shift-b': () => this.editor.commands.toggleBlockquote(),
      'Mod-Shift-i': () => this.editor.commands.toggleItalic(),
      'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),
    }
  },
})
