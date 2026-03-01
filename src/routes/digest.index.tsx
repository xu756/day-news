import { SITE_URL } from '#/lib/site'
import { Link, createFileRoute } from '@tanstack/react-router'
import { allDigests } from 'content-collections'

const canonical = `${SITE_URL}/digest`
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/lagoon-1.svg`
const LOOKBACK_DAYS = 14

export const Route = createFileRoute('/digest/')({
  head: () => ({
    links: [{ rel: 'canonical', href: canonical }],
    meta: [
      { title: 'AI资讯速览' },
      {
        name: 'description',
        content: '英文一手信源，每天 3 篇，附可追溯来源链接。',
      },
      { property: 'og:image', content: DEFAULT_OG_IMAGE },
    ],
  }),
  component: DigestIndex,
})

function formatDateLabel(isoString: string): string {
  return new Date(isoString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function sourceNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function DigestIndex() {
  const lookbackStart = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000

  const recent = [...allDigests]
    .sort(
      (a, b) => new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf(),
    )
    .filter((item) => new Date(item.pubDate).valueOf() >= lookbackStart)

  const groupedByDay = Array.from(
    recent.reduce((map, item) => {
      const day = item.pubDate.slice(0, 10)
      const current = map.get(day) ?? []
      current.push(item)
      map.set(day, current)
      return map
    }, new Map<string, typeof recent>()),
  )

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-10">
      <section className="mb-8 border-b border-[#c9d3cd] pb-5">
        <p className="m-0 text-[11px] font-semibold tracking-[0.16em] text-[#4f6b5d] uppercase">
          AI 资讯速览
        </p>
        <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-[#223531] sm:text-[2.2rem]">
          英文一手信源，如实呈现
        </h1>
        <p className="mb-0 mt-3 text-sm leading-6 text-[#5f7268]">
          每天 3 条，保留入选原因和原文来源，方便回溯。
        </p>
      </section>

      {groupedByDay.length === 0 ? (
        <section className="rounded border border-[#d6dfda] bg-white px-5 py-6 text-sm text-[#5f7268]">
          暂无日报内容。运行 <code>bun run digest:generate</code> 生成今日内容。
        </section>
      ) : (
        <div className="space-y-8">
          {groupedByDay.map(([day, items]) => {
            const dayCandidateCount = items[0]?.candidateCount

            return (
              <section key={day} className="space-y-3">
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="m-0 text-sm font-semibold tracking-wide text-[#6b7f73] uppercase">
                    {formatDateLabel(`${day}T00:00:00.000Z`)}
                  </h2>
                  {typeof dayCandidateCount === 'number' && items[0] ? (
                    <a
                      href={`/digest/${encodeURIComponent(items[0].slug)}#candidate-list`}
                      className="m-0 text-xs text-[#8a9a91]"
                    >
                      从 {dayCandidateCount} 条资讯中筛选
                    </a>
                  ) : null}
                </header>

                <div className="space-y-3">
                  {items.slice(0, 3).map((item, index) => {
                    const sourceNames = Array.from(
                      new Set(
                        item.sources?.length
                          ? item.sources.map((source) => source.name)
                          : item.sourceUrls.map((url) =>
                              sourceNameFromUrl(url),
                            ),
                      ),
                    ).slice(0, 4)

                    return (
                      <article
                        key={item.slug}
                        className="rounded border border-[#dbe3df] bg-white px-4 py-4 sm:px-5"
                      >
                        <p className="m-0 text-xs font-semibold tracking-wide text-[#90a097] uppercase">
                          {String(index + 1).padStart(2, '0')}
                        </p>

                        <h3 className="mb-0 mt-2 text-[1.02rem] leading-6 font-semibold text-[#1f322d]">
                          <Link
                            to="/digest/$slug"
                            params={{ slug: item.slug }}
                            className="text-inherit no-underline hover:underline"
                          >
                            {item.title}
                          </Link>
                        </h3>

                        <p className="mb-0 mt-2 text-sm leading-6 text-[#5f7268]">
                          入选理由：
                          {item.why ?? '按来源权重、时效性与多源交叉评分入选。'}
                        </p>

                        {sourceNames.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {sourceNames.map((name) => (
                              <span
                                key={`${item.slug}-${name}`}
                                className="rounded border border-[#d2dcd7] bg-[#f8fbf9] px-2.5 py-1 text-xs text-[#5a6d62]"
                              >
                                来源：{name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
