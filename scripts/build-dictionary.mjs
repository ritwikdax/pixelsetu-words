import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dictionaryDir = join(root, 'data/dictionary')
const source = join(dictionaryDir, 'words_dictionary.json')
const frequencySource = join(dictionaryDir, 'google-10000-english-no-swears.txt')
const outputDir = join(root, 'generated')
const output = join(outputDir, 'dictionary.txt')

const DEFAULT_WEIGHT = 1
const FREQUENCY_TOP_WEIGHT = 10_000

function loadFrequencyWeights() {
  const lines = readFileSync(frequencySource, 'utf8').split('\n')
  const weights = new Map()

  for (let index = 0; index < lines.length; index++) {
    const word = lines[index].trim().toLowerCase()
    if (!word) continue
    // Line 1 = most frequent → highest weight
    weights.set(word, FREQUENCY_TOP_WEIGHT - index)
  }

  return weights
}

function resolveWeight(word, customWeight, frequencyWeights) {
  const frequencyWeight = frequencyWeights.get(word) ?? DEFAULT_WEIGHT
  const custom = Number(customWeight) || DEFAULT_WEIGHT
  return Math.max(frequencyWeight, custom)
}

const dictionary = JSON.parse(readFileSync(source, 'utf8'))
const frequencyWeights = loadFrequencyWeights()

for (const [word, weight] of frequencyWeights.entries()) {
  if (!(word in dictionary)) {
    dictionary[word] = weight
  }
}

const entries = Object.entries(dictionary)
  .map(([word, weight]) => ({
    word,
    weight: resolveWeight(word, weight, frequencyWeights),
  }))
  .sort((a, b) => a.word.localeCompare(b.word))

mkdirSync(outputDir, { recursive: true })
writeFileSync(
  output,
  entries.map(({ word, weight }) => `${word}\t${weight}`).join('\n'),
  'utf8',
)

const fromGoogle = entries.filter((e) => frequencyWeights.has(e.word)).length
const customBoosted = entries.filter((e) => {
  const freq = frequencyWeights.get(e.word) ?? DEFAULT_WEIGHT
  return e.weight > freq
}).length

console.log(`Wrote ${entries.length.toLocaleString()} words to generated/dictionary.txt`)
console.log('Upload that file to ImageKit (pixelsetu-write/dictionary.txt) when publishing.')
console.log(`  ${fromGoogle.toLocaleString()} words ranked by Google 10k frequency`)
console.log(`  ${customBoosted.toLocaleString()} words with custom weight boosts`)
