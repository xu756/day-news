import { load } from 'cheerio'
import { fetchFirstSuccessfulText, fetchJson, fetchText } from './lib/fetch'
import { normalizeWhitespace, parseRssFeed } from './lib/parse'
import type { SourceConfig, SourceItem } from './lib/types'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function toIsoDate(raw?: string): string {
  if (!raw) return new Date().toISOString()
  const timestamp = Date.parse(raw)
  return Number.isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString()
}

type RssSourceConfig = {
  id: string
  name: string
  type: SourceConfig['type']
  feedUrls: string[]
  limit?: number
}

function sortByPublishedAtDesc(items: SourceItem[]): SourceItem[] {
  return [...items].sort(
    (a, b) => new Date(b.publishedAt).valueOf() - new Date(a.publishedAt).valueOf(),
  )
}

function rssSource(config: RssSourceConfig): SourceConfig {
  return {
    id: config.id,
    name: config.name,
    type: config.type,
    fetchLatest: async () => {
      const { text, url } = await fetchFirstSuccessfulText(config.feedUrls, undefined, {
        timeoutMs: 15000,
        retries: 2,
      })
      const parsed = parseRssFeed(text, url)

      return sortByPublishedAtDesc(
        parsed.slice(0, config.limit ?? 20).map((entry) => ({
          title: entry.title,
          url: entry.url,
          publishedAt: entry.publishedAt,
          sourceName: config.name,
          sourceType: config.type,
          snippet: entry.snippet,
        })),
      )
    },
  }
}

type HackerNewsHit = {
  objectID: string
  title?: string
  url?: string
  created_at: string
  points?: number
  num_comments?: number
}

const hackerNewsSource: SourceConfig = {
  id: 'hn-ai',
  name: 'Hacker News',
  type: 'community',
  fetchLatest: async () => {
    const sinceEpochSeconds = Math.floor((Date.now() - ONE_DAY_MS) / 1000)
    const url =
      `https://hn.algolia.com/api/v1/search_by_date?query=AI&` +
      `tags=story&numericFilters=created_at_i>${sinceEpochSeconds}&hitsPerPage=80`

    const payload = await fetchJson<{ hits: HackerNewsHit[] }>(
      url,
      undefined,
      {
        timeoutMs: 12000,
        retries: 2,
      },
    )

    const items = payload.hits
      .map((hit) => {
        const title = normalizeWhitespace(hit.title ?? '')
        if (!title) return null

        const canonicalUrl =
          hit.url?.trim() || `https://news.ycombinator.com/item?id=${hit.objectID}`
        return {
          title,
          url: canonicalUrl,
          publishedAt: new Date(hit.created_at).toISOString(),
          sourceName: 'Hacker News',
          sourceType: 'community',
          hnPoints: Math.max(0, hit.points ?? 0),
          hnComments: Math.max(0, hit.num_comments ?? 0),
        } satisfies SourceItem
      })
      .filter((item): item is SourceItem => item !== null)
      .sort((a, b) => {
        const aHeat = (a.hnPoints ?? 0) * 2 + (a.hnComments ?? 0) * 3
        const bHeat = (b.hnPoints ?? 0) * 2 + (b.hnComments ?? 0) * 3
        return bHeat - aHeat
      })
      .slice(0, 20)

    return items
  },
}

function parseHuggingFacePapers(html: string): SourceItem[] {
  const $ = load(html)
  const seenUrls = new Set<string>()
  const items: SourceItem[] = []

  $('a[href^="/papers/"]').each((_, element) => {
    if (items.length >= 25) return
    const href = $(element).attr('href')
    if (!href) return

    const url = new URL(href, 'https://huggingface.co').toString()
    if (seenUrls.has(url)) return

    const title = normalizeWhitespace($(element).text())
    if (title.length < 15) return

    const container = $(element).closest('article, li, section, div')
    const snippet = normalizeWhitespace(container.find('p').first().text())
    const publishedRaw =
      container.find('time').first().attr('datetime') ||
      container.find('time').first().text()

    items.push({
      title,
      url,
      publishedAt: toIsoDate(publishedRaw),
      sourceName: 'Hugging Face Papers',
      sourceType: 'papers',
      snippet: snippet || undefined,
    })

    seenUrls.add(url)
  })

  return items
}

const huggingFaceSource: SourceConfig = {
  id: 'huggingface-papers',
  name: 'Hugging Face Papers',
  type: 'papers',
  fetchLatest: async () => {
    const { text } = await fetchFirstSuccessfulText(
      [
        'https://huggingface.co/papers?sort=trending',
        'https://huggingface.co/papers',
      ],
      undefined,
      {
        timeoutMs: 15000,
        retries: 2,
      },
    )

    return parseHuggingFacePapers(text)
  },
}

const officialSources: SourceConfig[] = [
  rssSource({
    id: 'openai-news',
    name: 'OpenAI Blog',
    type: 'official',
    feedUrls: ['https://openai.com/news/rss.xml', 'https://openai.com/blog/rss.xml'],
  }),
  rssSource({
    id: 'anthropic-news',
    name: 'Anthropic News',
    type: 'official',
    feedUrls: [
      'https://www.anthropic.com/news/rss.xml',
      'https://www.anthropic.com/feed.xml',
    ],
  }),
  rssSource({
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    type: 'official',
    feedUrls: ['https://blog.google/technology/ai/rss/', 'https://blog.google/rss/'],
  }),
  rssSource({
    id: 'deepmind-blog',
    name: 'Google DeepMind Blog',
    type: 'official',
    feedUrls: [
      'https://deepmind.google/discover/blog/rss.xml',
      'https://deepmind.google/discover/rss.xml',
    ],
  }),
]

const mediaSources: SourceConfig[] = [
  rssSource({
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    type: 'media',
    feedUrls: ['https://techcrunch.com/category/artificial-intelligence/feed/'],
  }),
  rssSource({
    id: 'the-verge-ai',
    name: 'The Verge AI',
    type: 'media',
    feedUrls: [
      'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
      'https://www.theverge.com/artificial-intelligence/rss/index.xml',
    ],
  }),
]

const fallbackMediaSource: SourceConfig = rssSource({
  id: 'mit-tech-review-ai',
  name: 'MIT Technology Review (AI)',
  type: 'media',
  feedUrls: ['https://www.technologyreview.com/topic/artificial-intelligence/feed'],
})

export const SOURCES: SourceConfig[] = [
  ...officialSources,
  ...mediaSources,
  fallbackMediaSource,
  hackerNewsSource,
  huggingFaceSource,
]

export async function fetchAllSources(): Promise<SourceItem[]> {
  const settled = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const items = await source.fetchLatest()
      return items.map((item) => ({
        ...item,
        sourceName: source.name,
        sourceType: source.type,
      }))
    }),
  )

  const aggregated: SourceItem[] = []

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      aggregated.push(...result.value)
    }
  }

  return sortByPublishedAtDesc(aggregated)
}

export async function fetchArticleHtml(url: string): Promise<string> {
  return fetchText(url, undefined, { timeoutMs: 20000, retries: 2 })
}
