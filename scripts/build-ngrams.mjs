import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dictionaryDir = join(root, 'data/dictionary')
const googlePath = join(dictionaryDir, 'google-10000-english-no-swears.txt')
const seedBigrams = JSON.parse(readFileSync(join(root, 'data/seed-bigrams.json'), 'utf8'))
const seedTrigrams = JSON.parse(readFileSync(join(root, 'data/seed-trigrams.json'), 'utf8'))
const output = join(root, 'generated/prediction-ngrams.json')

const googleWords = readFileSync(googlePath, 'utf8')
  .split('\n')
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean)

const unigrams = {}
googleWords.forEach((word, index) => {
  unigrams[word] = googleWords.length - index
})

function buildNgramMap(seed, baseWeight) {
  const result = {}
  for (const [context, successors] of Object.entries(seed)) {
    const scores = {}
    successors.forEach((word, index) => {
      const freqBoost = unigrams[word] ?? 1
      scores[word] = baseWeight - index * 3 + Math.log10(freqBoost + 1) * 10
    })
    result[context] = scores
  }
  return result
}

const payload = {
  bigrams: buildNgramMap(seedBigrams, 120),
  trigrams: buildNgramMap(seedTrigrams, 180),
  unigrams,
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify(payload))

const bigramContexts = Object.keys(payload.bigrams).length
const trigramContexts = Object.keys(payload.trigrams).length
console.log(
  `Wrote generated/prediction-ngrams.json: ${bigramContexts} bigram contexts, ${trigramContexts} trigram contexts`,
)
console.log('Upload that file to ImageKit (pixelsetu-write/prediction-ngrams.json) when publishing.')
