import Image from '@tiptap/extension-image'

export const EmojiImage = Image.configure({
  inline: true,
  allowBase64: false,
  HTMLAttributes: {
    class: 'emoji-gif',
    loading: 'lazy',
    draggable: 'false',
  },
})
