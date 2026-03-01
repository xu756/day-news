import { MdxCallout } from '#/components/MdxCallout'
import { MdxMetrics } from '#/components/MdxMetrics'
import {
  type DigestPost,
  findDigestDayBySlug,
  formatZhDateLabel,
  getDayConfig,
  getDigestDays,
  getSourcesForDay,
} from '#/lib/digest'
import { SITE_URL } from '#/lib/site'
import { MDXContent } from '@content-collections/mdx/react'
import {
  Link,
  Outlet,
  createFileRoute,
  notFound,
  useLocation,
} from '@tanstack/react-router'

const DEFAULT_OG_IMAGE = '/images/lagoon-1.svg'

type SectionSource = {
  title: string
  url: string
  domain: string
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function normalizeTagText(text: string): string {
  return text
    .replace(/^[-*+]+[\s]*/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^[_*]+/, '')
    .replace(/[_*]+$/, '')
    .replace(/`/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[：:]\s*$/, '')
    .trim()
}

function compactTag(text: string): string {
  const cleaned = text.trim()
  if (cleaned.length === 0) return ''
  if (cleaned.includes('://') || cleaned.startsWith('http')) return ''

  const titleOnly = cleaned.split(/[：:]/)[0]?.trim() ?? cleaned
  if (titleOnly.length >= 3 && titleOnly.length <= 22) {
    return titleOnly
  }

  const firstSentence = cleaned.split(/[。；]/)[0]?.trim() ?? cleaned
  return firstSentence.slice(0, 26)
}

function pickTags(lines: string[]): string[] {
  const tags: string[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const tag = compactTag(normalizeTagText(line))
    if (!tag || seen.has(tag)) continue

    seen.add(tag)
    tags.push(tag)

    if (tags.length >= 3) break
  }

  return tags
}

function extractKeyTags(post: DigestPost): string[] {
  const lines = post.content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const headingLines = lines.filter((line) => /^\*\*.+\*\*$/.test(line))
  const headingTags = pickTags(headingLines)
  if (headingTags.length > 0) {
    return headingTags
  }

  const bulletLines = lines.filter((line) => /^[-*+]\s+/.test(line))
  const bulletTags = pickTags(bulletLines)

  if (bulletTags.length > 0) {
    return bulletTags
  }

  return pickTags(
    (post.why ?? '')
      .split(/[；。]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
}

function buildSectionSources(
  post: DigestPost,
  sourceTitleLookup: Map<string, string>,
): SectionSource[] {
  const items = post.sources?.length
    ? post.sources.map((source) => ({
        name: source.name,
        url: source.url,
      }))
    : post.sourceUrls.map((url) => ({
        name: domainFromUrl(url),
        url,
      }))

  return items.map((item) => {
    const normalized = normalizeUrl(item.url)

    return {
      title: sourceTitleLookup.get(normalized) ?? item.name,
      url: item.url,
      domain: domainFromUrl(item.url),
    }
  })
}

export const Route = createFileRoute('/digest/$slug')({
  loader: ({ params }) => {
    const digestDay = findDigestDayBySlug(params.slug)
    if (!digestDay) throw notFound()

    return digestDay
  },
  head: ({ loaderData, params }) => {
    const day = loaderData?.day
    const posts = loaderData?.posts ?? []
    const lead = loaderData?.lead
    const title =
      posts
        .slice(0, 2)
        .map((post) => post.title)
        .join('，') || 'Digest Story'
    const description = lead?.description ?? ''
    const image = lead?.heroImage ?? DEFAULT_OG_IMAGE
    const canonicalSlug = encodeURIComponent(params.slug)

    return {
      links: [
        { rel: 'canonical', href: `${SITE_URL}/digest/${canonicalSlug}` },
      ],
      meta: [
        { title: `${title} | AI资讯速览` },
        { name: 'description', content: description || `${day} AI资讯速览` },
        {
          property: 'og:image',
          content: image.startsWith('http') ? image : `${SITE_URL}${image}`,
        },
      ],
    }
  },
  component: DigestPost,
})

function DigestPost() {
  const digestDay = Route.useLoaderData()
  const location = useLocation()

  if (location.pathname.endsWith('/sources')) {
    return <Outlet />
  }

  const digestTitle = digestDay.posts
    .slice(0, 2)
    .map((post) => post.title)
    .join('，')
  const sourceSummary = getSourcesForDay(digestDay.day, digestDay.posts)
  const dayConfig = getDayConfig(digestDay.day)

  const sourceTitleLookup = new Map(
    sourceSummary.all.map((item) => [normalizeUrl(item.url), item.title]),
  )

  const featuredRemaining = sourceSummary.featured.slice(3)
  const related = getDigestDays()
    .filter((item) => item.day !== digestDay.day)
    .slice(0, 3)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
      <header className="py-8 text-center sm:py-10">
        <p className="inline-flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-slate-500">
          <time>{formatZhDateLabel(digestDay.day)}</time>
          <span className="text-slate-300">|</span>
          <Link
            to="/digest/$slug/sources"
            params={{ slug: digestDay.lead.slug }}
            className="transition hover:text-slate-800"
          >
            从 {sourceSummary.candidateCount} 条资讯中筛选
          </Link>
        </p>

        <h1 className="mx-auto mt-3 max-w-4xl text-balance font-serif text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">
          {digestTitle}
        </h1>

        <ol className="mx-auto mt-4 max-w-3xl text-left text-sm leading-7 text-slate-500 sm:text-base">
          {digestDay.posts.slice(0, 3).map((post, index) => (
            <li key={post.slug} className="inline">
              {index > 0 ? <span className="text-slate-300"> ｜ </span> : null}
              {post.title}
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-700 to-emerald-300" />
      </header>

      <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {dayConfig?.coverImage ? (
          <img
            src={dayConfig.coverImage}
            alt={
              dayConfig.coverAlt || `${formatZhDateLabel(digestDay.day)} 封面图`
            }
            className="block aspect-[16/7] w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[16/7] items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50/70">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-slate-400">
                Cover Slot
              </p>
              <p className="mt-2 text-sm text-slate-500">
                在 data.yaml 设置 coverImage 后会显示当天封面
              </p>
            </div>
          </div>
        )}
      </section>

      <main className="space-y-5">
        {digestDay.posts.map((post, index) => {
          const keyTags = extractKeyTags(post)
          const sectionSources = buildSectionSources(post, sourceTitleLookup)

          return (
            <article
              key={post.slug}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            >
              <h2 className="flex items-start gap-3 text-xl font-bold text-slate-900 sm:text-2xl">
                <span className="mt-0.5 w-10 shrink-0 font-mono text-2xl text-amber-700 sm:text-3xl">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{post.title}</span>
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-700 sm:text-base">
                <strong className="mr-1 text-slate-900">
                  为什么值得关注：
                </strong>
                {post.why ?? '该条目由来源权重、时效性与多源交叉评分综合入选。'}
              </p>

              <div className="prose prose-slate mt-4 max-w-none prose-headings:text-emerald-800 prose-a:text-blue-700 prose-a:no-underline hover:prose-a:text-blue-800">
                {post.mdx ? (
                  <MDXContent
                    code={post.mdx}
                    components={{ MdxCallout, MdxMetrics }}
                  />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: post.html ?? '' }} />
                )}
              </div>

              {keyTags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {keyTags.map((tag) => (
                    <span
                      key={`${post.slug}-${tag}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {sectionSources.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-lg font-semibold text-slate-400">
                    来源
                  </p>
                  <div className="space-y-1.5">
                    {sectionSources.map((source) => (
                      <a
                        key={`${post.slug}-${source.url}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex flex-wrap items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
                      >
                        <span>{source.title}</span>
                        <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                          {source.domain}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}

        {featuredRemaining.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {featuredRemaining.map((item, idx) => (
              <article
                key={item.url}
                className="flex gap-3 border-t border-slate-100 py-3 first:border-t-0"
              >
                <span className="w-8 shrink-0 font-mono text-2xl text-slate-300">
                  {String(idx + 4).padStart(2, '0')}
                </span>

                <div className="min-w-0">
                  <p className="text-base font-semibold leading-7 text-slate-900">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="transition hover:text-emerald-700"
                    >
                      {item.title}
                    </a>
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {item.sourceNames.join(' / ')}
                    {' · '}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500 transition hover:text-slate-700"
                    >
                      {domainFromUrl(item.url)}
                    </a>
                  </p>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </main>

      <section
        className="mt-8 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-5"
        aria-label="分享"
      >
        <span className="mr-1 text-xs text-slate-400">分享</span>
        {['微信', '微博', 'X', '复制链接'].map((label) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            {label}
          </button>
        ))}
      </section>

      <nav className="mt-8" aria-label="继续阅读">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          继续阅读
        </h2>

        <div className="space-y-2">
          {related.map((day) => (
            <Link
              key={day.day}
              to="/digest/$slug"
              params={{ slug: day.lead.slug }}
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <span className="font-mono text-xs text-slate-400">
                {formatZhDateLabel(day.day)}
              </span>
              <span className="text-sm text-slate-700">
                {day.posts[0]?.title}
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-3 text-sm text-slate-500">
          <a href="/digest" className="transition hover:text-slate-800">
            查看全部存档 →
          </a>
        </p>
      </nav>
    </div>
  )
}
