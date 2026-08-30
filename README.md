# Pixelsetu Word

A developer-friendly rich text editor — a minimal MS Word / Google Docs alternative built on [TipTap](https://tiptap.dev).

## Features

- **Full-page editor** — distraction-free writing surface with a paper-like document layout
- **Animated cursor** — smooth sliding caret with a blinking animation
- **Developer terminal** — press `Ctrl + \`` to open a sliding terminal with shell-like commands
- **Multi-page documents** — create, switch, rename, and delete pages
- **Export** — export the current page as Markdown or PDF
- **Auto-save** — pages persist in localStorage

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Terminal Commands

| Command | Description |
|---------|-------------|
| `touch [name]` | Create a new document page |
| `ls` | List all pages |
| `open <name\|id>` | Switch to a page |
| `rm <name\|id>` | Delete a page |
| `mv <old> <new>` | Rename a page |
| `export md` | Export current page as Markdown |
| `export pdf` | Export current page as PDF |
| `clear` | Clear terminal output |
| `help` | Show available commands |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + \`` | Toggle developer terminal |
| `Escape` | Close terminal (when focused) |

## Tech Stack

- React + TypeScript + Vite
- TipTap (ProseMirror)
- Turndown (HTML → Markdown)
- jsPDF + html2canvas (PDF export)
