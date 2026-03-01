import { describe, expect, it } from 'vitest'
import { selectStoriesByAttention } from '../../scripts/digest/lib/picker'
import type { CandidateItem } from '../../scripts/digest/lib/types'

function makeCandidate(overrides: Partial<CandidateItem>): CandidateItem {
  const title = overrides.title ?? 'Sample story'
  const url = overrides.url ?? 'https://example.com/story'

  return {
    title,
    url,
    publishedAt: overrides.publishedAt ?? new Date().toISOString(),
    sourceName: overrides.sourceName ?? 'Example',
    sourceType: overrides.sourceType ?? 'media',
    normalizedUrl: overrides.normalizedUrl ?? url,
    normalizedTitle:
      overrides.normalizedTitle ?? title.toLowerCase().replace(/\s+/g, ' '),
    tokens: overrides.tokens ?? ['sample', 'story'],
    entities: overrides.entities ?? ['Sample'],
    clusterId: overrides.clusterId,
    clusterSize: overrides.clusterSize,
    score: overrides.score ?? 40,
    snippet: overrides.snippet,
    hnPoints: overrides.hnPoints,
    hnComments: overrides.hnComments,
  }
}

describe('selectStoriesByAttention', () => {
  it('selects top stories from highest attention clusters first', () => {
    const items: CandidateItem[] = [
      makeCandidate({
        title: 'OpenAI major release',
        url: 'https://openai.com/a',
        sourceType: 'official',
        clusterId: 'c1',
        clusterSize: 3,
        score: 72,
      }),
      makeCandidate({
        title: 'OpenAI partner analysis',
        url: 'https://example.com/a2',
        sourceType: 'media',
        clusterId: 'c1',
        clusterSize: 3,
        score: 58,
      }),
      makeCandidate({
        title: 'Anthropic policy change',
        url: 'https://example.com/b1',
        sourceType: 'media',
        clusterId: 'c2',
        clusterSize: 2,
        score: 63,
      }),
      makeCandidate({
        title: 'HN top discussion',
        url: 'https://news.ycombinator.com/item?id=1',
        sourceType: 'community',
        clusterId: 'c3',
        clusterSize: 1,
        score: 38,
        hnPoints: 420,
        hnComments: 180,
      }),
    ]

    const stories = selectStoriesByAttention(items, 3)

    expect(stories).toHaveLength(3)
    expect(stories[0].headline).toBe('HN top discussion')

    const headlines = stories.map((story) => story.headline)
    expect(headlines).toContain('OpenAI major release')
    expect(headlines).toContain('Anthropic policy change')

    const openAiStory = stories.find((story) => story.headline === 'OpenAI major release')
    expect(openAiStory?.relatedUrls).toContain('https://openai.com/a')
    expect(openAiStory?.relatedUrls).toContain('https://example.com/a2')
  })

  it('falls back to remaining items when clusters are insufficient', () => {
    const items: CandidateItem[] = [
      makeCandidate({
        title: 'Single story 1',
        url: 'https://example.com/1',
        clusterId: 'single-1',
        score: 30,
      }),
      makeCandidate({
        title: 'Single story 2',
        url: 'https://example.com/2',
        clusterId: 'single-2',
        score: 29,
      }),
    ]

    const stories = selectStoriesByAttention(items, 3)
    expect(stories).toHaveLength(2)
    expect(stories[0].headline).toBe('Single story 1')
    expect(stories[1].headline).toBe('Single story 2')
  })
})
