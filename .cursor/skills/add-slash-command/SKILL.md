---
name: add-slash-command
description: Adds a / slash command to the editor picker. Use when adding or changing slash menu items, categories, or apply() handlers.
---

# Add a slash command

Edit `src/data/slashCommands.ts` only unless the command needs a new TipTap command.

- Fields: `id`, `label`, `description`, `keywords[]` (search), `icon`, `category` (`blocks` | `lists` | `inline` | `tools`), `apply(chain, editor)`.
- `apply` must return the chained commands. Use existing `chain.setHeading` / `toggleX` / custom `insertCurlBlock` etc.
- New block types: add the extension first (skill `add-tiptap-extension`), then point `apply` at its command.

Picker UI: `SlashCommandPicker.tsx` + `slashCommandPicker.ts`. Do not duplicate the command list there.
