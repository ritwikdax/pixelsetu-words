import { useEffect, useState } from 'react'

export type ExcalidrawThemeMode = 'light' | 'dark'

export const EXCALIDRAW_LIGHT_BG = '#ffffff'
export const EXCALIDRAW_DARK_BG = '#1e1e1e'

function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const value = color.trim()
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
      }
    }
    if (hex.length === 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }
    return null
  }
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!rgb) return null
  return {
    r: Number(rgb[1]),
    g: Number(rgb[2]),
    b: Number(rgb[3]),
  }
}

function isDarkPageBackground(color: string): boolean {
  const rgb = parseRgb(color)
  if (!rgb) return false
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 < 140
}

export function getExcalidrawThemeMode(): ExcalidrawThemeMode {
  const pageBg = getComputedStyle(document.documentElement).getPropertyValue('--page-bg').trim()
  return isDarkPageBackground(pageBg) ? 'dark' : 'light'
}

export function useExcalidrawThemeMode(): ExcalidrawThemeMode {
  const [mode, setMode] = useState(getExcalidrawThemeMode)

  useEffect(() => {
    const sync = () => setMode(getExcalidrawThemeMode())
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return mode
}
