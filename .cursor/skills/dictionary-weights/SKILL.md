---
name: dictionary-weights
description: Updates autocomplete word weights and ngram assets. Use when changing dictionary rankings, adding words, or running build:dictionary / sync:weights / build:ngrams.
---

# Dictionary weights

1. Add or change entries in `scripts/word-weight-overrides.json` (`"word": number`). Higher = stronger autocomplete rank (frequency list uses up to 10000).
2. Run `npm run sync:weights` (writes `data/dictionary/words_dictionary.json`).
3. `npm run build:dictionary` → `generated/dictionary.txt`; `npm run build:ngrams` → `generated/prediction-ngrams.json`. Upload both to ImageKit (`pixelsetu-write/`). Runtime URLs live in `src/data/languageAssets.ts`.
4. Do not write these into `public/` or hand-edit `words_dictionary.json` except via `sync:weights`.

Personal/learned ranking is separate (`wordMemory.ts` IndexedDB). Do not mix those scores into the static dictionary files.
