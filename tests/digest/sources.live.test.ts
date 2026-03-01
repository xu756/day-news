import { describe, expect, it } from 'vitest'
import { SOURCES } from '../../scripts/digest/sources'

const shouldRunLive = process.env.RUN_LIVE_SOURCE_TESTS === '1'
const liveDescribe = shouldRunLive ? describe : describe.skip

liveDescribe('digest live source fetchers', () => {
  for (const source of SOURCES) {
    it(
      `fetches latest items from ${source.name}`,
      async () => {
        const items = await source.fetchLatest()

        expect(items.length).toBeGreaterThan(0)

        for (const item of items.slice(0, 5)) {
          expect(item.title.length).toBeGreaterThan(5)
          expect(item.url.startsWith('http')).toBe(true)
          expect(Number.isNaN(new Date(item.publishedAt).valueOf())).toBe(false)
          expect(item.sourceName).toBe(source.name)
          expect(item.sourceType).toBe(source.type)
        }
      },
      45_000,
    )
  }
})
