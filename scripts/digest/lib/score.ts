import type { CandidateItem, SourceType } from './types'

const SOURCE_WEIGHT: Record<SourceType, number> = {
  official: 42,
  media: 28,
  papers: 24,
  community: 16,
}

const HOUR_MS = 60 * 60 * 1000

function recencyScore(publishedAt: string, now = Date.now()): number {
  const ageMs = now - new Date(publishedAt).valueOf()
  if (ageMs <= 24 * HOUR_MS) return 26
  if (ageMs <= 48 * HOUR_MS) return 16
  if (ageMs <= 72 * HOUR_MS) return 9
  if (ageMs <= 7 * 24 * HOUR_MS) return 4
  return 0
}

function hnScore(item: CandidateItem): number {
  const points = item.hnPoints ?? 0
  const comments = item.hnComments ?? 0
  return Math.min(24, points * 0.12 + comments * 0.2)
}

function clusterScore(item: CandidateItem): number {
  const clusterSize = item.clusterSize ?? 1
  return Math.min(18, Math.max(0, clusterSize - 1) * 6)
}

export function scoreItem(item: CandidateItem, now = Date.now()): number {
  const source = SOURCE_WEIGHT[item.sourceType]
  const freshness = recencyScore(item.publishedAt, now)
  const heat = hnScore(item)
  const cluster = clusterScore(item)
  const snippetBonus = item.snippet ? Math.min(4, item.snippet.length / 120) : 0

  return Number((source + freshness + heat + cluster + snippetBonus).toFixed(2))
}

export function scoreCandidates(items: CandidateItem[]): CandidateItem[] {
  const now = Date.now()
  return items
    .map((item) => ({
      ...item,
      score: scoreItem(item, now),
    }))
    .sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      return new Date(b.publishedAt).valueOf() - new Date(a.publishedAt).valueOf()
    })
}
