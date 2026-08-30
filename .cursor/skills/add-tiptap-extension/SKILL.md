---
name: add-tiptap-extension
description: Adds a TipTap node, mark, or command and wires it into Editor.tsx and slash commands. Use when adding editor blocks, node views, or / slash items.
---

# Add a TipTap extension

1. Prefer `src/extensions/<camelName>/index.ts` + `*View.tsx` if it has UI (see `curlBlock`). Simple marks can be a single file (`emojiReplacer.ts`).
2. `Node.create` / `Extension.create` with a stable `name`. For insert commands, `declare module '@tiptap/core'` and `addCommands`.
3. React views: `ReactNodeViewRenderer`. Atoms (`atom: true`) for widgets like curl. Isolating/locked for `agentOutput`-like content.
4. Register in `Editor.tsx` `useEditor({ extensions })`. If it replaces a StarterKit node, disable that key in `StarterKit.configure` (as with `paragraph` / `codeBlock`).
5. Slash entry: `src/data/slashCommands.ts` (`id`, `keywords`, `category`, `apply` on the chain).
6. If agents should insert the block, extend `NoteBlockSpec` / parsers in `src/utils/noteBlocks.ts`.

Keep new keybindings in `editorShortcuts.ts` (editor) vs `shortcuts.ts` (app). Do not grow `Editor.tsx` with node internals.
