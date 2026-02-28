import type { CandidateCluster, CandidateItem, SourceItem } from './types'

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'for',
  'with',
  'from',
  'in',
  'on',
  'of',
  'at',
  'is',
  'are',
  'new',
  'latest',
  'today',
  'this',
  'that',
  'as',
  'by',
  'after',
  'into',
  'about',
  'via',
  'ai',
])

const TRACKING_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
])

export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()

    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key)
      }
    }

    url.searchParams.sort()
    const normalized = url.toString()
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  } catch {
    return rawUrl.trim()
  }
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeTitle(normalizedTitle: string): string[] {
  return normalizedTitle
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
}

export function extractEntities(title: string): string[] {
  const matches = title.match(/[A-Z][A-Za-z0-9\-]{1,}(?:\s+[A-Z][A-Za-z0-9\-]{1,})*/g) ?? []
  const cleaned = matches
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && value.toLowerCase() !== 'ai')

  return [...new Set(cleaned)]
}

export function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)

  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection += 1
  }

  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = Array.from({ length: a.length + 1 }, (_, rowIndex) =>
    Array.from({ length: b.length + 1 }, (_, colIndex) => {
      if (rowIndex === 0) return colIndex
      if (colIndex === 0) return rowIndex
      return 0
    }),
  )

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      )
    }
  }

  return matrix[a.length][b.length]
}

export function titleSimilarity(a: CandidateItem, b: CandidateItem): number {
  const tokenScore = jaccardSimilarity(a.tokens, b.tokens)

  const maxLength = Math.max(a.normalizedTitle.length, b.normalizedTitle.length, 1)
  const distance = levenshteinDistance(a.normalizedTitle, b.normalizedTitle)
  const editScore = 1 - distance / maxLength

  return Math.max(tokenScore, editScore)
}

function hasSharedEntity(a: CandidateItem, b: CandidateItem): boolean {
  if (a.entities.length === 0 || b.entities.length === 0) return false
  const set = new Set(a.entities.map((value) => value.toLowerCase()))
  return b.entities.some((value) => set.has(value.toLowerCase()))
}

function toCandidateItem(item: SourceItem): CandidateItem {
  const normalizedTitle = normalizeTitle(item.title)

  return {
    ...item,
    normalizedUrl: normalizeUrl(item.url),
    normalizedTitle,
    tokens: tokenizeTitle(normalizedTitle),
    entities: extractEntities(item.title),
  }
}

export function dedupeCandidates(items: SourceItem[]): CandidateItem[] {
  const byUrl = new Set<string>()
  const result: CandidateItem[] = []

  for (const item of items) {
    const candidate = toCandidateItem(item)
    if (byUrl.has(candidate.normalizedUrl)) continue

    const duplicatedByTitle = result.some((existing) => {
      if (existing.normalizedTitle === candidate.normalizedTitle) {
        return true
      }

      const similarity = titleSimilarity(existing, candidate)
      if (similarity >= 0.92) return true
      if (similarity >= 0.8 && hasSharedEntity(existing, candidate)) return true
      return false
    })

    if (duplicatedByTitle) continue

    byUrl.add(candidate.normalizedUrl)
    result.push(candidate)
  }

  return result
}

export function clusterCandidates(items: CandidateItem[]): {
  clusters: CandidateCluster[]
  items: CandidateItem[]
} {
  const clusters: CandidateCluster[] = []

  for (const item of items) {
    let matchedCluster: CandidateCluster | null = null

    for (const cluster of clusters) {
      const anchor = cluster.items[0]
      const similarity = titleSimilarity(anchor, item)
      const sharedEntity = hasSharedEntity(anchor, item)

      if (similarity >= 0.68 || (similarity >= 0.45 && sharedEntity)) {
        matchedCluster = cluster
        break
      }
    }

    if (!matchedCluster) {
      const id = `cluster-${clusters.length + 1}`
      matchedCluster = {
        id,
        label: item.title,
        items: [],
      }
      clusters.push(matchedCluster)
    }

    matchedCluster.items.push(item)
    item.clusterId = matchedCluster.id
  }

  for (const cluster of clusters) {
    for (const item of cluster.items) {
      item.clusterSize = cluster.items.length
    }
  }

  return { clusters, items }
}
