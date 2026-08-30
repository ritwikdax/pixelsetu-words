import Link from '@tiptap/extension-link'

export const DocumentLink = Link.configure({
  openOnClick: false,
  linkOnPaste: true,
  autolink: true,
  defaultProtocol: 'https',
  HTMLAttributes: {
    class: 'editor-link',
    rel: 'noopener noreferrer',
    target: '_blank',
  },
})
