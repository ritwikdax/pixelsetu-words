import type { DocumentPage } from '../types'
import { downloadFile, exportToPdf, htmlToMarkdown } from './export'
import { normalizePageOrientation } from './pageOrientation'
import { SHORTCUT_REFERENCE } from './shortcuts'
import { formatShortcutDisplay } from './shortcutDisplay'
import { clearWordMemory, exportWordMemory } from './wordMemory'
import {
  clearGeminiApiKey,
  getGeminiApiKey,
  hasGeminiApiKey,
  maskApiKey,
  setGeminiApiKey,
} from '../runtime/keyStore'
import { THEMES, getNextTheme, isTheme, type Theme } from '../data/themes'

export const USER = 'pixelsetu'
export const HOST = 'word'
export const HOME = '~/notes'

export function promptPrefix() {
  return `${USER}@${HOST}:${HOME}$`
}

export const HELP_LINES = [
  'notes',
  '  ls / tree           — list pages',
  '  pwd                 — current note path',
  '  cd <name|id>        — switch to a page',
  '  cat [name]          — print a page as markdown',
  '  touch [name]        — create a note',
  '  nano [name]         — create if needed, then open in the editor',
  '  rm [name|id|.]      — delete a page (current note if omitted; refuses the last one)',
  '  mv <old> <new>      — rename a page',
  '  wc [name]           — word / line / character count',
  '  export md | pdf     — export the current page',
  '  lock / freeze [.|id] — freeze a note as readonly',
  '  unlock / reheat [.|id] — thaw a note so it is editable again',
  '',
  'shell',
  '  whoami, hostname, date, uname, echo, history, env, which',
  '  clear, exit, help / man [cmd]',
  '',
  'fun',
  '  neofetch            — about this notebook',
  '  fortune             — a tiny writing nudge',
  '  cowsay [text]       — a cow, obviously',
  '',
  'app',
  '  theme <name|next>   — switch color theme (run theme to list names)',
  '  shortcuts           — keyboard shortcuts',
  '  memory stats|clear  — learned word patterns',
  '  gemini --set-key | --status | --clear',
]

const KNOWN_COMMANDS = [
  'help',
  'man',
  'clear',
  'cls',
  'exit',
  'logout',
  'quit',
  'ls',
  'dir',
  'tree',
  'pwd',
  'cd',
  'cat',
  'head',
  'tail',
  'touch',
  'nano',
  'vim',
  'vi',
  'nvim',
  'code',
  'edit',
  'open',
  'rm',
  'mv',
  'wc',
  'export',
  'lock',
  'freeze',
  'unlock',
  'reheat',
  'whoami',
  'hostname',
  'date',
  'uname',
  'echo',
  'history',
  'env',
  'which',
  'neofetch',
  'about',
  'fortune',
  'cowsay',
  'theme',
  'shortcuts',
  'memory',
  'gemini',
  'mkdir',
  'sudo',
  'ping',
]

const ALIASES: Record<string, string> = {
  cls: 'clear',
  dir: 'ls',
  logout: 'exit',
  quit: 'exit',
  q: 'exit',
  vim: 'nano',
  vi: 'nano',
  nvim: 'nano',
  code: 'nano',
  edit: 'nano',
  about: 'neofetch',
  fetch: 'neofetch',
  freeze: 'lock',
  reheat: 'unlock',
}

const FORTUNES = [
  'Write the ugly first sentence. The second one is usually kinder.',
  'A blank page is not a verdict. It is just waiting.',
  'Short paragraphs travel further than you think.',
  'If you are stuck, change the title — then the note has somewhere to go.',
  'Delete one sentence you are proud of. The rest of the page will thank you.',
  'Notes are for thinking out loud. Publish later.',
  'The cow in cowsay has never missed a deadline. You can too.',
  'Tomorrow-you cannot find what today-you never wrote down.',
]

export interface ShellContext {
  pages: DocumentPage[]
  activePage?: DocumentPage
  activePageId: string
  history: string[]
  theme: Theme
  findPage: (query: string) => DocumentPage | undefined
  getPageContent: (id: string) => string
  onCreatePage: (title?: string) => DocumentPage
  onSelectPage: (id: string) => void
  onDeletePage: (id: string) => void
  onRenamePage: (id: string, title: string) => void
  onSetPageLocked: (id: string, locked: boolean) => void
  onSetTheme: (theme: Theme) => void
  onCycleTheme: () => void
  onClose: () => void
}

export interface ShellIO {
  print: (type: 'output' | 'error' | 'success', text: string) => void
  clear: () => void
}

export function tokenize(raw: string): string[] {
  const out: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (const ch of raw.trim()) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (/\s/.test(ch)) {
      if (current) {
        out.push(current)
        current = ''
      }
      continue
    }
    current += ch
  }

  if (current) out.push(current)
  return out
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const dp: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

function closestCommand(cmd: string): string | null {
  let best = ''
  let bestDist = Infinity
  for (const name of KNOWN_COMMANDS) {
    const dist = levenshtein(cmd, name)
    if (dist < bestDist) {
      bestDist = dist
      best = name
    }
  }
  return bestDist <= 2 ? best : null
}

function pagePath(page: DocumentPage) {
  return `${HOME}/${page.title}`
}

function resolvePage(ctx: ShellContext, query?: string): DocumentPage | undefined {
  if (!query || query === '.') return ctx.activePage
  return ctx.findPage(query)
}

function pageMarkdown(ctx: ShellContext, page: DocumentPage) {
  return htmlToMarkdown(ctx.getPageContent(page.id)).trim()
}

function countWords(text: string) {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/).length : 0
  const lines = trimmed ? trimmed.split(/\n/).length : 0
  return { words, lines, chars: text.length }
}

function cowsay(message: string) {
  const text = message || 'write something, human'
  const width = Math.min(48, Math.max(text.length, 8))
  const top = ` ${'_'.repeat(width + 2)}`
  const bot = ` ${'-'.repeat(width + 2)}`
  const padded = text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width)
  return [
    top,
    `< ${padded} >`,
    bot,
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||',
  ].join('\n')
}

function ensurePage(ctx: ShellContext, name?: string): DocumentPage {
  if (!name) return ctx.onCreatePage()
  const existing = ctx.findPage(name)
  if (existing) return existing
  return ctx.onCreatePage(name)
}

export async function runShellCommand(
  raw: string,
  ctx: ShellContext,
  io: ShellIO,
): Promise<void> {
  const parts = tokenize(raw)
  const invoked = (parts[0] ?? '').toLowerCase()
  const cmd = ALIASES[invoked] ?? invoked
  const args = parts.slice(1)

  if (cmd === 'gemini') {
    const flag = args[0]?.toLowerCase()
    if (flag === '--set-key' || flag === 'set-key') {
      const key = args.slice(1).join(' ').trim()
      if (!key) {
        io.print('error', 'usage: gemini --set-key <your-api-key>')
      } else {
        try {
          await setGeminiApiKey(key)
          io.print('success', `Gemini API key saved (${maskApiKey(key)})`)
        } catch (error) {
          io.print('error', error instanceof Error ? error.message : 'Failed to save API key')
        }
      }
    } else if (flag === '--status' || flag === 'status') {
      const configured = await hasGeminiApiKey()
      if (!configured) {
        io.print('output', 'Gemini API key: not set')
        io.print('output', 'Run: gemini --set-key <your-api-key>')
      } else {
        const key = await getGeminiApiKey()
        io.print('success', `Gemini API key: ${key ? maskApiKey(key) : 'configured'} (encrypted)`)
      }
    } else if (flag === '--clear' || flag === 'clear') {
      await clearGeminiApiKey()
      io.print('success', 'Gemini API key cleared')
    } else {
      io.print('output', 'usage: gemini --set-key | --status | --clear')
    }
    return
  }

  switch (cmd) {
    case 'help':
      HELP_LINES.forEach((line) => io.print('output', line))
      break

    case 'man': {
      const topic = args[0]?.toLowerCase()
      if (!topic || topic === 'help') {
        HELP_LINES.forEach((line) => io.print('output', line))
        break
      }
      const match = HELP_LINES.find((line) => line.trim().startsWith(topic))
      if (match) {
        io.print('output', match.trim())
      } else {
        io.print('error', `no manual entry for ${topic}`)
      }
      break
    }

    case 'clear':
      io.clear()
      break

    case 'exit':
      io.print('output', 'logout')
      ctx.onClose()
      break

    case 'whoami':
      io.print('output', USER)
      break

    case 'hostname':
      io.print('output', HOST)
      break

    case 'pwd':
      io.print('output', ctx.activePage ? pagePath(ctx.activePage) : HOME)
      break

    case 'date':
      io.print('output', new Date().toString())
      break

    case 'uname':
      if (args[0] === '-a' || args[0] === '--all') {
        io.print(
          'output',
          `PixelsetuWord 0.1.0 ${HOST} notebook-kernel ${navigator.platform || 'browser'}`,
        )
      } else {
        io.print('output', 'PixelsetuWord')
      }
      break

    case 'echo':
      io.print('output', args.join(' '))
      break

    case 'history':
      if (ctx.history.length === 0) {
        io.print('output', '(empty)')
      } else {
        ;[...ctx.history].reverse().forEach((entry, i) => {
          io.print('output', `  ${String(i + 1).padStart(4)}  ${entry}`)
        })
      }
      break

    case 'env':
      io.print('output', `USER=${USER}`)
      io.print('output', `HOST=${HOST}`)
      io.print('output', `HOME=${HOME}`)
      io.print('output', `PWD=${ctx.activePage ? pagePath(ctx.activePage) : HOME}`)
      io.print('output', `THEME=${ctx.theme}`)
      io.print('output', `PAGES=${ctx.pages.length}`)
      io.print('output', `LOCKED=${ctx.activePage?.locked ? '1' : '0'}`)
      io.print('output', `SHELL=pixelsetu-bash`)
      break

    case 'which': {
      const name = args[0]?.toLowerCase()
      if (!name) {
        io.print('error', 'usage: which <command>')
        break
      }
      const resolved = ALIASES[name] ?? name
      if (KNOWN_COMMANDS.includes(name) || ALIASES[name]) {
        io.print('output', `/usr/bin/${resolved}`)
      } else {
        io.print('error', `${name} not found`)
      }
      break
    }

    case 'ls':
    case 'tree':
      if (ctx.pages.length === 0) {
        io.print('output', '(no pages)')
      } else if (cmd === 'tree') {
        io.print('output', `${HOME}`)
        ctx.pages.forEach((page, index) => {
          const last = index === ctx.pages.length - 1
          const branch = last ? '└──' : '├──'
          const marker = page.id === ctx.activePageId ? '  ← you are here' : ''
          const frozen = page.locked ? ' [ro]' : ''
          io.print('output', `${branch} ${page.title}${frozen}${marker}`)
        })
      } else {
        ctx.pages.forEach((page) => {
          const marker = page.id === ctx.activePageId ? '→' : ' '
          const frozen = page.locked ? '  [ro]' : ''
          io.print('output', `${marker} ${page.id.slice(0, 8)}  ${page.title}${frozen}`)
        })
      }
      break

    case 'cd':
    case 'open': {
      const query = args.join(' ')
      if (!query || query === '~' || query === HOME || query === '/') {
        io.print('output', HOME)
        io.print('output', 'tip: cd <note name> to open a page')
        break
      }
      const page = ctx.findPage(query)
      if (!page) {
        io.print('error', `cd: no such note: ${query}`)
        io.print('output', 'try ls, or touch "' + query + '" to create it')
      } else {
        ctx.onSelectPage(page.id)
        io.print('success', pagePath(page))
      }
      break
    }

    case 'cat':
    case 'head':
    case 'tail': {
      const query = args.join(' ')
      const page = resolvePage(ctx, query || undefined)
      if (!page) {
        io.print('error', `${cmd}: no such note`)
        break
      }
      const markdown = pageMarkdown(ctx, page)
      if (!markdown) {
        io.print('output', `(empty note: ${page.title})`)
        break
      }
      const lines = markdown.split('\n')
      const sliced =
        cmd === 'head' ? lines.slice(0, 10) : cmd === 'tail' ? lines.slice(-10) : lines
      sliced.forEach((line) => io.print('output', line))
      break
    }

    case 'wc': {
      const query = args.join(' ')
      const page = resolvePage(ctx, query || undefined)
      if (!page) {
        io.print('error', 'wc: no such note')
        break
      }
      const markdown = pageMarkdown(ctx, page)
      const stats = countWords(markdown)
      io.print(
        'output',
        ` ${stats.lines}  ${stats.words}  ${stats.chars}  ${page.title}`,
      )
      break
    }

    case 'touch': {
      const name = args.join(' ') || undefined
      const existed = name ? Boolean(ctx.findPage(name)) : false
      const page = ensurePage(ctx, name)
      ctx.onSelectPage(page.id)
      if (existed) {
        io.print('output', `touched ${pagePath(page)}`)
      } else {
        io.print('success', `created ${pagePath(page)}`)
        io.print('output', `tip: nano "${page.title}" opens it in the editor`)
      }
      break
    }

    case 'nano': {
      const name = args.join(' ') || undefined
      const page = name ? ensurePage(ctx, name) : ctx.activePage ?? ctx.onCreatePage()
      ctx.onSelectPage(page.id)
      io.print('success', `opening ${pagePath(page)} in the editor…`)
      ctx.onClose()
      break
    }

    case 'rm': {
      const query = args.join(' ')
      const page =
        !query || query === '.' ? ctx.activePage : ctx.findPage(query)
      if (!page) {
        io.print('error', query ? `rm: no such note: ${query}` : 'rm: no current note')
      } else if (ctx.pages.length <= 1) {
        io.print('error', 'rm: cannot delete the last page')
      } else {
        ctx.onDeletePage(page.id)
        io.print('success', `deleted "${page.title}"`)
      }
      break
    }

    case 'mv': {
      if (args.length < 2) {
        io.print('error', 'usage: mv <old> <new>')
        break
      }
      const oldName = args[0]
      const newName = args.slice(1).join(' ')
      const page = ctx.findPage(oldName)
      if (!page) {
        io.print('error', `mv: no such note: ${oldName}`)
      } else if (page.locked) {
        io.print('error', `mv: "${page.title}" is frozen — unlock it first`)
      } else {
        ctx.onRenamePage(page.id, newName)
        io.print('success', `${HOME}/${oldName} -> ${HOME}/${newName}`)
      }
      break
    }

    case 'lock': {
      const query = args.join(' ')
      const page = resolvePage(ctx, query || undefined)
      if (!page) {
        io.print('error', query ? `lock: no such note: ${query}` : 'lock: no current note')
      } else if (page.locked) {
        io.print('output', `"${page.title}" is already frozen (readonly)`)
      } else {
        ctx.onSetPageLocked(page.id, true)
        io.print('success', `chmod -w ${pagePath(page)} — frozen, readonly`)
      }
      break
    }

    case 'unlock': {
      const query = args.join(' ')
      const page = resolvePage(ctx, query || undefined)
      if (!page) {
        io.print('error', query ? `unlock: no such note: ${query}` : 'unlock: no current note')
      } else if (!page.locked) {
        io.print('output', `"${page.title}" is already writable`)
      } else {
        ctx.onSetPageLocked(page.id, false)
        io.print('success', `chmod +w ${pagePath(page)} — thawed, editable`)
      }
      break
    }

    case 'export': {
      const format = args[0]?.toLowerCase()
      if (!ctx.activePage) {
        io.print('error', 'no active page')
        break
      }
      const html = ctx.getPageContent(ctx.activePage.id)
      const safeName = ctx.activePage.title.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()

      if (format === 'md' || format === 'markdown') {
        downloadFile(htmlToMarkdown(html), `${safeName}.md`, 'text/markdown')
        io.print('success', `exported ${safeName}.md`)
      } else if (format === 'pdf') {
        const target = document.querySelector('[data-export-target]') as HTMLElement | null
        if (!target) {
          io.print('error', 'export target not found')
        } else {
          io.print('output', 'generating PDF…')
          try {
            await exportToPdf(
              target,
              `${safeName}.pdf`,
              normalizePageOrientation(ctx.activePage.orientation),
            )
            io.print('success', `exported ${safeName}.pdf`)
          } catch {
            io.print('error', 'PDF export failed')
          }
        }
      } else {
        io.print('error', 'usage: export md | export pdf')
      }
      break
    }

    case 'memory': {
      const action = args[0]?.toLowerCase()
      if (action === 'clear') {
        await clearWordMemory()
        io.print('success', 'cleared learned word memory')
      } else if (action === 'stats') {
        const records = await exportWordMemory()
        const contexts = records.length
        const pairs = records.reduce((sum, r) => sum + Object.keys(r.successors).length, 0)
        io.print('output', `learned contexts: ${contexts}`)
        io.print('output', `learned word pairs: ${pairs}`)
      } else {
        io.print('output', 'usage: memory stats | memory clear')
      }
      break
    }

    case 'shortcuts':
      SHORTCUT_REFERENCE.forEach((item) => {
        const keys = formatShortcutDisplay(item.keys)
        io.print('output', `  ${keys.padEnd(22)} ${item.action}`)
      })
      break

    case 'theme': {
      const mode = args[0]?.toLowerCase()
      if (isTheme(mode)) {
        ctx.onSetTheme(mode)
        io.print('success', `theme set to ${mode}`)
      } else if (mode === 'next' || mode === 'toggle') {
        const nextTheme = getNextTheme(ctx.theme)
        ctx.onCycleTheme()
        io.print('success', `theme set to ${nextTheme}`)
      } else {
        io.print('output', `current theme: ${ctx.theme}`)
        io.print('output', `available: ${THEMES.map((entry) => entry.id).join(', ')}`)
        io.print('output', 'usage: theme <name> | theme next')
      }
      break
    }

    case 'neofetch': {
      const pageCount = ctx.pages.length
      io.print('output', '      __________')
      io.print('output', '     |  notes  |     pixelsetu@word')
      io.print('output', '     |  ____   |     --------------')
      io.print('output', '     | |    |  |     OS: Pixelsetu Word')
      io.print('output', `     | |____|  |     Shell: pretend-bash`)
      io.print('output', `     |_________|     Pages: ${pageCount}`)
      io.print('output', `                     Theme: ${ctx.theme}`)
      io.print(
        'output',
        `                     Now: ${ctx.activePage ? ctx.activePage.title : '—'}`,
      )
      break
    }

    case 'fortune': {
      const tip = FORTUNES[Math.floor(Math.random() * FORTUNES.length)]
      io.print('output', tip)
      break
    }

    case 'cowsay':
      io.print('output', cowsay(args.join(' ')))
      break

    case 'mkdir':
      io.print('output', 'mkdir: this notebook is flat — every note is already a file.')
      io.print('output', 'try: touch "new note"   or   nano "new note"')
      break

    case 'sudo':
      io.print('error', 'sudo: pixelsetu is not in the sudoers file. This incident will be written… into a note.')
      break

    case 'ping':
      io.print('output', 'PING notebook: 56 data bytes')
      io.print('output', '64 bytes from localhost: icmp_seq=1 ttl=64 time=0.1 ms')
      io.print('output', 'it is all happening in your browser, friend.')
      break

    default: {
      const suggestion = closestCommand(invoked)
      io.print('error', `command not found: ${invoked}`)
      if (suggestion) {
        io.print('output', `did you mean: ${suggestion}?`)
      } else {
        io.print('output', 'type "help" for commands')
      }
    }
  }
}
