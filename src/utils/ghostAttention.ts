/**
 * Sentence-level attention for ghost (inline) next-word suggestions.
 * Popover prefix search does not use this.
 */

export const GHOST_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'so',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'onto',
  'to',
  'up',
  'with',
  'about',
  'after',
  'before',
  'over',
  'under',
  'than',
  'then',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'is',
  'am',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'not',
  'no',
  'nor',
  'too',
  'very',
  'just',
  'also',
])

const SUBJECTS = new Set([
  'i',
  "i'm",
  "i've",
  "i'd",
  "i'll",
  'we',
  "we're",
  "we've",
  'you',
  "you're",
  'they',
  "they're",
  'he',
  "he's",
  'she',
  "she's",
  'it',
  "it's",
])

const COPULAS = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being'])

const INFINITIVE_HEADS = new Set([
  'going',
  'gone',
  'want',
  'wants',
  'wanted',
  'need',
  'needs',
  'needed',
  'try',
  'tries',
  'tried',
  'trying',
  'have',
  'has',
  'had',
  'used',
  'able',
  'unable',
  'supposed',
  'ought',
  'hope',
  'hoped',
  'like',
  'love',
  'hate',
  'plan',
  'plans',
  'decide',
  'decided',
  'seem',
  'seems',
  'start',
  'started',
  'begin',
  'continue',
  'fail',
  'refuse',
  'agree',
  'intend',
  'meant',
  'mean',
])

const ARTICLES = new Set(['a', 'an', 'the'])

const PREPOSITIONS = new Set([
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'from',
  'by',
  'into',
  'about',
  'over',
  'after',
  'before',
  'through',
  'without',
])

const COMMON_VERBS = new Set([
  'be',
  'go',
  'see',
  'do',
  'get',
  'make',
  'have',
  'take',
  'come',
  'know',
  'think',
  'want',
  'need',
  'try',
  'look',
  'find',
  'give',
  'use',
  'work',
  'say',
  'tell',
  'ask',
  'feel',
  'become',
  'leave',
  'put',
  'mean',
  'keep',
  'let',
  'begin',
  'seem',
  'help',
  'talk',
  'turn',
  'start',
  'show',
  'hear',
  'play',
  'run',
  'move',
  'live',
  'believe',
  'hold',
  'bring',
  'happen',
  'write',
  'provide',
  'sit',
  'stand',
  'lose',
  'pay',
  'meet',
  'include',
  'continue',
  'set',
  'learn',
  'change',
  'lead',
  'understand',
  'watch',
  'follow',
  'stop',
  'create',
  'speak',
  'read',
  'allow',
  'add',
  'spend',
  'grow',
  'open',
  'walk',
  'win',
  'offer',
  'remember',
  'love',
  'consider',
  'appear',
  'buy',
  'wait',
  'serve',
  'die',
  'send',
  'expect',
  'build',
  'stay',
  'fall',
  'cut',
  'reach',
  'kill',
  'remain',
  'suggest',
  'raise',
  'pass',
  'sell',
  'require',
  'report',
  'decide',
  'pull',
])

export const SENTENCE_STARTERS = new Set([
  'i',
  'the',
  'this',
  'we',
  'it',
  'there',
  'if',
  'when',
  'my',
  'a',
  'you',
  'they',
  'he',
  'she',
])

export function normalizeGhostToken(value: string): string {
  return value.replace(/\u2019/g, "'").toLowerCase().trim()
}

export function softmax(logits: number[]): number[] {
  if (logits.length === 0) return []
  const max = Math.max(...logits)
  const exps = logits.map((value) => Math.exp(value - max))
  const sum = exps.reduce((total, value) => total + value, 0)
  if (sum <= 0) return logits.map(() => 1 / logits.length)
  return exps.map((value) => value / sum)
}

/** Recency + content-word attention over the current sentence. */
export function attentionWeights(tokens: string[]): number[] {
  const n = tokens.length
  if (n === 0) return []

  const logits = tokens.map((token, index) => {
    let logit = ((index + 1) / n) * 2.4
    if (!GHOST_STOPWORDS.has(token)) logit += 0.85
    if (index === n - 1) logit += 1.7
    if (index === n - 2) logit += 0.55
    return logit
  })

  return softmax(logits)
}

export function slotBonus(tokens: string[], word: string): number {
  const last = tokens[tokens.length - 1]
  const prev = tokens[tokens.length - 2]

  if (!last) {
    return SENTENCE_STARTERS.has(word) ? 42 : 0
  }

  let bonus = 0

  if (last === 'going' && word === 'to') bonus += 72
  if (INFINITIVE_HEADS.has(last) && word === 'to') bonus += 58
  if (last === 'to' && INFINITIVE_HEADS.has(prev ?? '') && COMMON_VERBS.has(word)) {
    bonus += 48
  }

  if (SUBJECTS.has(last)) {
    if (COPULAS.has(word)) bonus += 38
    if (COMMON_VERBS.has(word)) bonus += 28
  }

  if (COPULAS.has(last)) {
    if (word === 'going' || word === 'not' || ARTICLES.has(word)) bonus += 32
  }

  if (ARTICLES.has(last)) {
    if (GHOST_STOPWORDS.has(word) && word !== 'other') bonus -= 28
    else bonus += 22
  }

  if (PREPOSITIONS.has(last) && ARTICLES.has(word)) bonus += 26

  return bonus
}

export function repeatPenalty(tokens: string[], word: string): number {
  if (GHOST_STOPWORDS.has(word)) return 0
  const last = tokens[tokens.length - 1]
  if (last === word) return 90
  const repeats = tokens.filter((token) => token === word).length
  return repeats * 28
}

export function ghostDisplayWord(word: string, sentenceTokens: string[]): string {
  if (sentenceTokens.length > 0) return word
  if (word === 'i' || word.startsWith("i'")) {
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
  return word.charAt(0).toUpperCase() + word.slice(1)
}
