# Pixelsetu Word — Cursor context

This folder is the **source of truth for agents**. Prefer these files over scanning `src/`, `dist/`, or `node_modules/`.

| Path | When it loads |
|------|----------------|
| `rules/project.mdc` | Every chat (architecture map) |
| `rules/conventions.mdc` | Every chat (how to edit) |
| Other `rules/*.mdc` | When matching files are in context |
| `skills/*/SKILL.md` | When the task matches the skill description |

Do not read `dist/`, `generated/`, or huge JSON under `data/dictionary/` unless the task is the dictionary build pipeline.
