import {
  findDigestDayBySlug,
  formatZhDateLabel,
  getSourcesForDay,
} from '#/lib/digest'
import { SITE_URL } from '#/lib/site'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/digest/$slug/sources')({
  loader: ({ params }) => {
    const digestDay = findDigestDayBySlug(params.slug)
    if (!digestDay) throw notFound()

    const sources = getSourcesForDay(digestDay.day, digestDay.posts)

    return {
      digestDay,
      sources,
    }
  },
  head: ({ loaderData, params }) => {
    const day = loaderData?.digestDay.day ?? ''
    const title = `${formatZhDateLabel(day)}信息源`

    return {
      links: [
        {
          rel: 'canonical',
          href: `${SITE_URL}/digest/${encodeURIComponent(params.slug)}/sources`,
        },
      ],
      meta: [{ title: `${title} | AI资讯速览` }],
    }
  },
  component: DigestSourcesPage,
})

function SourceSection(props: {
  title: string
  items: Array<{
    title: string
    url: string
    sourceNames: string[]
    sourceTypes: string[]
    score?: number
    mentions: number
  }>
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
        {props.title}
      </h2>
      <div className="space-y-3">
        {props.items.map((item) => (
          <article
            key={item.url}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-base font-medium leading-7 text-slate-900 transition hover:text-emerald-700"
            >
              {item.title}
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.sourceNames.map((name) => (
                <span
                  key={`${item.url}-${name}`}
                  className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500"
                >
                  {name}
                </span>
              ))}
              {item.sourceTypes.map((type) => (
                <span
                  key={`${item.url}-${type}`}
                  className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500"
                >
                  {type}
                </span>
              ))}
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                {item.mentions}
              </span>
              {typeof item.score === 'number' ? (
                <span className="ml-auto rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700">
                  {item.score.toFixed(2)}
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function DigestSourcesPage() {
  const { digestDay, sources } = Route.useLoaderData()

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
      <section className="py-8 text-center sm:py-12">
        <Link
          to="/digest/$slug"
          params={{ slug: digestDay.lead.slug }}
          className="text-sm text-slate-500 transition hover:text-slate-800"
        >
          ← 返回文章
        </Link>

        <h1 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
          {formatZhDateLabel(digestDay.day)}信息源
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          从 {sources.candidateCount} 条资讯中选出 {sources.featured.length}{' '}
          条重点报道
        </p>
      </section>

      <SourceSection title="重点关注" items={sources.featured} />
      <SourceSection title="候选资讯" items={sources.all} />
    </main>
  )
}
