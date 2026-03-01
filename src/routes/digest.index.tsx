import { RevealOnScroll } from '#/components/RevealOnScroll'
import {
  formatZhDateLabel,
  getDigestDays,
  getSourcesForDay,
} from '#/lib/digest'
import { SITE_URL } from '#/lib/site'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

const canonical = `${SITE_URL}/digest`
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/lagoon-1.svg`

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

function SectionTitles(props: { titles: string[]; compact?: boolean }) {
  return (
    <ol className="space-y-2">
      {props.titles.map((title, index) => {
        const num = String(index + 1).padStart(2, '0')
        const isLead = index === 0

        return (
          <li
            key={`${num}-${title}`}
            className={`flex items-start gap-3 ${isLead ? 'text-slate-900' : 'text-slate-500'}`}
          >
            <span
              className={`mt-0.5 w-7 shrink-0 font-mono text-sm font-semibold ${
                isLead ? 'text-amber-700' : 'text-slate-300'
              }`}
            >
              {num}
            </span>
            <span
              className={
                isLead
                  ? 'text-lg leading-8 sm:text-[1.35rem]'
                  : 'text-base leading-7'
              }
            >
              {title}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function DayCard(props: {
  day: string
  slug: string
  titles: string[]
  candidateCount: number
  featured?: boolean
}) {
  const navigate = useNavigate()

  function openDigest() {
    navigate({
      to: '/digest/$slug',
      params: { slug: props.slug },
    })
  }

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`${formatZhDateLabel(props.day)} 资讯卡片`}
      onClick={openDigest}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openDigest()
        }
      }}
      className={`group relative block rounded-3xl border border-emerald-200/60 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:p-8 ${
        props.featured ? 'bg-gradient-to-br from-white to-emerald-50/60' : ''
      }`}
    >
      <span className="mb-5 block h-1.5 w-14 rounded-full bg-gradient-to-r from-emerald-700 to-emerald-300" />
      <p className="mb-4 font-mono text-xs text-slate-400">
        {formatZhDateLabel(props.day)}
      </p>
      <SectionTitles titles={props.titles} compact={!props.featured} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-emerald-700 transition group-hover:text-emerald-800">
          阅读全文 →
        </span>
        <Link
          to="/digest/$slug/sources"
          params={{ slug: props.slug }}
          onClick={(event) => event.stopPropagation()}
          className="font-mono text-xs text-slate-400 transition hover:text-slate-700"
        >
          从 {props.candidateCount} 条资讯中筛选
        </Link>
      </div>
    </article>
  )
}

function DigestIndex() {
  const digestDays = getDigestDays()
  const featured = digestDays[0]
  const archive = digestDays.slice(1)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
      <section className="py-10 text-center sm:py-14">
        <h1 className="mx-auto max-w-3xl text-balance font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-6xl sm:leading-tight">
          英文一手信源，如实呈现
        </h1>
        <p className="mt-3 text-sm tracking-wide text-slate-500 sm:text-base">
          不炸裂，不夸张，不接商单
        </p>
      </section>

      {digestDays.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          暂无日报内容。运行{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">
            bun run digest:generate
          </code>{' '}
          生成今日内容。
        </section>
      ) : (
        <>
          {featured ? (
            <RevealOnScroll
              className="will-change-transform"
              data-testid="featured-day-card"
            >
              <DayCard
                day={featured.day}
                slug={featured.lead.slug}
                titles={featured.posts.slice(0, 3).map((post) => post.title)}
                candidateCount={
                  getSourcesForDay(featured.day, featured.posts).candidateCount
                }
                featured
              />
            </RevealOnScroll>
          ) : null}

          <ul className="mt-5 space-y-4">
            {archive.map((digestDay, index) => (
              <li key={digestDay.day}>
                <RevealOnScroll
                  className="will-change-transform"
                  delayMs={Math.min(index * 70, 420)}
                >
                  <DayCard
                    day={digestDay.day}
                    slug={digestDay.lead.slug}
                    titles={digestDay.posts
                      .slice(0, 3)
                      .map((post) => post.title)}
                    candidateCount={
                      getSourcesForDay(digestDay.day, digestDay.posts)
                        .candidateCount
                    }
                  />
                </RevealOnScroll>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-sm text-slate-500">
            <a href="/digest" className="transition hover:text-slate-800">
              查看全部存档 →
            </a>
          </p>
        </>
      )}
    </main>
  )
}
