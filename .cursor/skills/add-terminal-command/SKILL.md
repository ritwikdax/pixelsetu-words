---
name: add-terminal-command
description: Adds a command to the in-app DevTerminal fake Unix shell. Use when adding ls/theme/gemini-style terminal commands or help text.
---

# Add a terminal command

1. Implement in `src/utils/terminalShell.ts` (dispatch switch / helpers). Commands operate on in-memory pages + callbacks from `DevTerminal`, not a real OS.
2. Append to `HELP_LINES` and `KNOWN_COMMANDS` (help, `which`, autocomplete).
3. Wire new app effects through the shell context object already passed in (pages, theme, gemini key, memory)—do not import React into the shell.

Keep the playful Unix tone. Secrets: only via `keyStore` helpers already used by `gemini --set-key`.
