import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'

export const lowlight = createLowlight(common)

export const CodeBlockHighlight = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: 'javascript',
  HTMLAttributes: {
    class: 'code-block',
  },
})
