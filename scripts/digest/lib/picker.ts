import type { PickedStory } from './llm'
import type { CandidateItem } from './types'

const MAX_RELATED_URLS = 8

function inferCategory(item: CandidateItem): string {
  const title = item.title.toLowerCase()

  if (item.sourceType === 'official') {
    if (/policy|war|government|regulat|pentagon|defense|security/.test(title)) {
      return 'Policy & Defense'
    }

    if (/funding|raise|valuation|partnership|investment/.test(title)) {
      return 'Industry & Finance'
    }

    if (/model|launch|release|agent|api|feature|product/.test(title)) {
      return 'Product Updates'
    }

    return 'Official Updates'
  }

  if (item.sourceType === 'media') return 'Industry'
  if (item.sourceType === 'papers') return 'Research'
  return 'Community'
}

function buildWhy(item: CandidateItem, relatedCount: number): string {
  const reasons: string[] = []

  reasons.push('基于英文一手信源抓取并去重后进入候选')

  if ((item.clusterSize ?? 1) > 1) {
    reasons.push(`同主题多源交叉（${item.clusterSize} 条）`)
  }

  if ((item.hnPoints ?? 0) > 0 || (item.hnComments ?? 0) > 0) {
    reasons.push(
      `HN 热度 ${item.hnPoints ?? 0} points / ${item.hnComments ?? 0} comments`,
    )
  }

  reasons.push(`综合评分 ${item.score ?? 0}`)
  reasons.push(`关联来源 ${relatedCount} 条`)

  return reasons.join('；')
}

function attentionScore(item: CandidateItem): number {
  const base = item.score ?? 0
  const hnHeat = (item.hnPoints ?? 0) * 0.25 + (item.hnComments ?? 0) * 0.4
  const multiSource = Math.max(0, (item.clusterSize ?? 1) - 1) * 2
  return Number((base + hnHeat + multiSource).toFixed(2))
}

function clusterRank(items: CandidateItem[]): CandidateItem[][] {
  const map = new Map<string, CandidateItem[]>()

  for (const item of items) {
    const clusterId = item.clusterId ?? `single-${item.normalizedUrl}`
    const arr = map.get(clusterId) ?? []
    arr.push(item)
    map.set(clusterId, arr)
  }

  for (const [, arr] of map) {
    arr.sort((a, b) => attentionScore(b) - attentionScore(a))
  }

  return [...map.values()].sort((a, b) => {
    const aScore = attentionScore(a[0]) + a.length
    const bScore = attentionScore(b[0]) + b.length
    return bScore - aScore
  })
}

export function selectStoriesByAttention(
  items: CandidateItem[],
  count = 3,
): PickedStory[] {
  const clusters = clusterRank(items)
  const selected: PickedStory[] = []
  const usedUrls = new Set<string>()

  for (const cluster of clusters) {
    if (selected.length >= count) break

    const lead = cluster[0]
    if (usedUrls.has(lead.url)) continue

    const relatedUrls = cluster
      .map((item) => item.url)
      .filter((url, index, arr) => arr.indexOf(url) === index)
      .slice(0, MAX_RELATED_URLS)

    for (const url of relatedUrls) usedUrls.add(url)

    selected.push({
      headline: lead.title,
      category: inferCategory(lead),
      why: buildWhy(lead, relatedUrls.length),
      relatedUrls,
    })
  }

  if (selected.length < count) {
    for (const item of items) {
      if (selected.length >= count) break
      if (usedUrls.has(item.url)) continue

      usedUrls.add(item.url)
      selected.push({
        headline: item.title,
        category: inferCategory(item),
        why: buildWhy(item, 1),
        relatedUrls: [item.url],
      })
    }
  }

  return selected.slice(0, count)
}
