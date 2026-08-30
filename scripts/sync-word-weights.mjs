import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'data/dictionary/words_dictionary.json')
const overridesPath = join(root, 'scripts', 'word-weight-overrides.json')

const dictionary = JSON.parse(readFileSync(source, 'utf8'))
const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'))

let updated = 0
let added = 0
for (const [word, weight] of Object.entries(overrides)) {
  if (!(word in dictionary)) {
    dictionary[word] = weight
    added++
    continue
  }
  dictionary[word] = weight
  updated++
}

writeFileSync(source, JSON.stringify(dictionary, null, 2) + '\n', 'utf8')
console.log(`Updated ${updated} word weights, added ${added} new words in data/dictionary/words_dictionary.json`)
