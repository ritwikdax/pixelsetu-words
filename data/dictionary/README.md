# Dictionary sources

Raw word lists used by the build scripts. Do not edit these by hand unless you are updating the source corpus.

| File | Purpose |
|------|---------|
| `words_dictionary.json` | Main word list with optional per-word weights (`word → weight`) |
| `google-10000-english-no-swears.txt` | Google 10k English frequency list (line order = frequency) |

## Build outputs

The app loads these from ImageKit at runtime (`src/data/languageAssets.ts`), not from `public/`.

- `npm run build:dictionary` → `generated/dictionary.txt` (upload to ImageKit)
- `npm run sync:weights` → applies `scripts/word-weight-overrides.json` to `words_dictionary.json`
- `npm run build:ngrams` → `generated/prediction-ngrams.json` (Google list + `data/seed-*.json`; upload to ImageKit)
