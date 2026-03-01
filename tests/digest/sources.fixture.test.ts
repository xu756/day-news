import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SOURCES } from '../../scripts/digest/sources'

const RSS_TEMPLATE = (title: string, link: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Feed</title>
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <pubDate>Sun, 01 Mar 2026 08:00:00 GMT</pubDate>
      <description>Example snippet</description>
    </item>
  </channel>
</rss>`

const HF_HTML = `
<html>
  <body>
    <article>
      <a href="/papers/2602.12345">Sample Multimodal Agent Paper</a>
      <time datetime="2026-03-01T00:00:00.000Z"></time>
      <p>Paper snippet from Hugging Face.</p>
    </article>
  </body>
</html>
`

const HN_PAYLOAD = {
  hits: [
    {
      objectID: '123',
      title: 'Interesting AI launch on HN',
      url: 'https://example.com/hn-ai',
      created_at: '2026-03-01T00:00:00.000Z',
      points: 120,
      num_comments: 42,
    },
  ],
}

function mockResponse(url: string): Response {
  if (url.includes('hn.algolia.com/api/v1/search_by_date')) {
    return new Response(JSON.stringify(HN_PAYLOAD), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (url.includes('huggingface.co/papers')) {
    return new Response(HF_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
  }

  const rssTitleBySource: Array<[string, string, string]> = [
    ['openai.com', 'OpenAI launches new model', 'https://openai.com/news/new-model'],
    ['anthropic.com', 'Anthropic posts safety update', 'https://www.anthropic.com/news/safety-update'],
    ['blog.google', 'Google AI ships major release', 'https://blog.google/technology/ai/example'],
    ['deepmind.google', 'DeepMind announces benchmark', 'https://deepmind.google/discover/blog/example'],
    ['techcrunch.com', 'TechCrunch AI story', 'https://techcrunch.com/ai-story'],
    ['theverge.com', 'The Verge AI story', 'https://www.theverge.com/ai-story'],
    ['technologyreview.com', 'MIT Technology Review AI story', 'https://www.technologyreview.com/ai-story'],
  ]

  for (const [host, title, link] of rssTitleBySource) {
    if (url.includes(host)) {
      return new Response(RSS_TEMPLATE(title, link), {
        status: 200,
        headers: { 'content-type': 'application/xml' },
      })
    }
  }

  return new Response('not found', { status: 404 })
}

describe('digest source fetchers with fixtures', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      return mockResponse(url)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  for (const source of SOURCES) {
    it(`fetchLatest works for ${source.name}`, async () => {
      const items = await source.fetchLatest()
      expect(items.length).toBeGreaterThan(0)

      const first = items[0]
      expect(first.title.length).toBeGreaterThan(5)
      expect(first.url.startsWith('http')).toBe(true)
      expect(first.sourceName).toBe(source.name)
      expect(first.sourceType).toBe(source.type)
    })
  }
})
