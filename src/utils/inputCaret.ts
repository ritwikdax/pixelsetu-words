export interface CaretRect {
  top: number
  left: number
  height: number
}

function getLineHeightPx(style: CSSStyleDeclaration): number {
  const fontSize = parseFloat(style.fontSize) || 16
  const lineHeight = style.lineHeight

  if (lineHeight === 'normal') {
    return fontSize * 1.2
  }

  const parsed = parseFloat(lineHeight)
  if (Number.isNaN(parsed)) {
    return fontSize * 1.2
  }

  return lineHeight.endsWith('px') ? parsed : parsed * fontSize
}

/** Screen coordinates for the caret inside a single-line text input. */
export function getInputCaretRect(input: HTMLInputElement): CaretRect {
  const inputRect = input.getBoundingClientRect()
  const style = window.getComputedStyle(input)
  const selectionStart = input.selectionStart ?? input.value.length

  const paddingLeft = parseFloat(style.paddingLeft) || 0
  const paddingTop = parseFloat(style.paddingTop) || 0
  const paddingBottom = parseFloat(style.paddingBottom) || 0
  const lineHeight = getLineHeightPx(style)
  const contentHeight = inputRect.height - paddingTop - paddingBottom

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      top: inputRect.top + paddingTop + Math.max(0, (contentHeight - lineHeight) / 2),
      left: inputRect.left + paddingLeft,
      height: lineHeight,
    }
  }

  const font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  ctx.font = font

  const letterSpacing = parseFloat(style.letterSpacing) || 0
  const textBefore = input.value.slice(0, selectionStart)
  let width = 0
  for (let index = 0; index < textBefore.length; index += 1) {
    width += ctx.measureText(textBefore[index]!).width + letterSpacing
  }

  return {
    left: inputRect.left + paddingLeft + width - input.scrollLeft,
    top: inputRect.top + paddingTop + Math.max(0, (contentHeight - lineHeight) / 2),
    height: lineHeight,
  }
}

/** Screen coordinates for the caret inside a textarea. */
export function getTextareaCaretRect(textarea: HTMLTextAreaElement): CaretRect {
  const selectionStart = textarea.selectionStart ?? textarea.value.length
  const textareaRect = textarea.getBoundingClientRect()
  const style = window.getComputedStyle(textarea)
  const lineHeight = getLineHeightPx(style)

  const mirror = document.createElement('div')
  const mirrorStyle = mirror.style
  mirrorStyle.position = 'absolute'
  mirrorStyle.visibility = 'hidden'
  mirrorStyle.whiteSpace = style.whiteSpace
  mirrorStyle.wordWrap = style.wordWrap
  mirrorStyle.overflowWrap = style.overflowWrap
  mirrorStyle.overflow = 'hidden'
  mirrorStyle.top = '0'
  mirrorStyle.left = '-9999px'
  mirrorStyle.fontFamily = style.fontFamily
  mirrorStyle.fontSize = style.fontSize
  mirrorStyle.fontWeight = style.fontWeight
  mirrorStyle.fontStyle = style.fontStyle
  mirrorStyle.letterSpacing = style.letterSpacing
  mirrorStyle.textTransform = style.textTransform
  mirrorStyle.wordSpacing = style.wordSpacing
  mirrorStyle.lineHeight = style.lineHeight
  mirrorStyle.padding = style.padding
  mirrorStyle.border = style.border
  mirrorStyle.boxSizing = style.boxSizing
  mirrorStyle.width = `${textareaRect.width}px`

  const textBefore = textarea.value.slice(0, selectionStart)
  mirror.textContent = textBefore

  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  const markerRect = marker.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  document.body.removeChild(mirror)

  const paddingLeft = parseFloat(style.paddingLeft) || 0
  const paddingTop = parseFloat(style.paddingTop) || 0

  return {
    left:
      textareaRect.left +
      paddingLeft +
      (markerRect.left - mirrorRect.left) -
      textarea.scrollLeft,
    top:
      textareaRect.top + paddingTop + (markerRect.top - mirrorRect.top) - textarea.scrollTop,
    height: lineHeight,
  }
}
