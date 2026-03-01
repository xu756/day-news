import { MdxCallout } from '#/components/MdxCallout'
import { MdxMetrics } from '#/components/MdxMetrics'
import { SITE_URL } from '#/lib/site'
import { MDXContent } from '@content-collections/mdx/react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { allDigests } from 'content-collections'

const DEFAULT_OG_IMAGE = '/images/lagoon-1.svg'

export const Route = createFileRoute('/digest/$slug')({
  loader: ({ params }) => {
    const digest = Array.from(
      new Map(
        [...allDigests]
          .sort(
            (a, b) =>
              new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf(),
          )
          .map((entry) => [entry.slug, entry]),
      ).values(),
    ).find((entry) => entry.slug === params.slug)

    if (!digest) {
      throw notFound()
    }

    return digest
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.title ?? 'Digest Story'
    const description = loaderData?.description ?? ''
    const image = loaderData?.heroImage ?? DEFAULT_OG_IMAGE
    const canonicalSlug = encodeURIComponent(params.slug)

    return {
      links: [
        { rel: 'canonical', href: `${SITE_URL}/digest/${canonicalSlug}` },
      ],
      meta: [
        { title },
        { name: 'description', content: description },
        {
          property: 'og:image',
          content: image.startsWith('http') ? image : `${SITE_URL}${image}`,
        },
      ],
    }
  },
  component: DigestPost,
})

function formatDate(isoString: string): string {
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

function DigestPost() {
  const post = Route.useLoaderData()
  const candidateItems = post.candidateItems ?? []
  const candidateCount = post.candidateCount ?? candidateItems.length

  return (
    <main className="mx-auto w-full max-w-[820px] px-4 pb-16 pt-10">
      <article className="rounded border border-[#dbe3df] bg-white px-5 py-6 sm:px-7 sm:py-8">
        {post.heroImage ? (
          <img
            src={post.heroImage}
            alt=""
            className="mb-6 h-56 w-full rounded object-cover sm:h-72"
          />
        ) : null}

        <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7b8f83] uppercase">
          AI 资讯速览
        </p>
        <h1 className="mb-0 mt-3 text-3xl leading-tight font-semibold text-[#1f322d] sm:text-[2.05rem]">
          {post.title}
        </h1>
        <p className="mb-0 mt-2 text-sm text-[#6a7b72]">
          {formatDate(post.pubDate)}
        </p>

        <section className="mt-6 rounded border border-[#d8e2dd] bg-[#f8fbf9] px-4 py-3">
          <h2 className="m-0 text-sm font-semibold text-[#2e423c]">
            为什么是这篇
          </h2>
          <p className="mb-0 mt-1.5 text-sm leading-6 text-[#5f7268]">
            {post.why ?? '该条目由来源权重、时效性与多源交叉评分综合入选。'}
          </p>
        </section>

        <div className="prose prose-slate mt-8 max-w-none prose-headings:text-[#243a34] prose-p:text-[#4e6158] prose-li:text-[#4e6158] prose-a:text-[#2e7669]">
          {post.mdx ? (
            <MDXContent
              code={post.mdx}
              components={{ MdxCallout, MdxMetrics }}
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: post.html ?? '' }} />
          )}
        </div>

        <section className="mt-8 border-t border-[#dde5e1] pt-5">
          <h2 className="m-0 text-lg font-semibold text-[#2e423c]">来源</h2>
          <ul className="mb-0 mt-3 space-y-2 pl-5 text-sm text-[#566960]">
            {(post.sources?.length
              ? post.sources
              : post.sourceUrls.map((url) => ({
                  name: sourceNameFromUrl(url),
                  url,
                }))
            ).map((source) => (
              <li key={source.url}>
                {source.name}
                {' · '}
                <a href={source.url} target="_blank" rel="noreferrer noopener">
                  {source.url}
                </a>
              </li>
            ))}
          </ul>
        </section>

        {candidateItems.length > 0 ? (
          <section
            id="candidate-list"
            className="mt-8 border-t border-[#dde5e1] pt-5"
          >
            <header className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
              <h2 className="m-0 text-lg font-semibold text-[#2e423c]">
                候选资讯
              </h2>
              <p className="m-0 text-xs text-[#7d8d84]">
                从 {candidateCount} 条资讯中筛选
              </p>
            </header>
            <ol className="mb-0 mt-0 space-y-2 pl-5 text-sm text-[#4f6259]">
              {candidateItems.map((item, index) => (
                <li key={`${item.url}-${index}`} className="leading-6">
                  <a href={item.url} target="_blank" rel="noreferrer noopener">
                    {item.title}
                  </a>
                  {item.sourceName ? ` · ${item.sourceName}` : ''}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>
    </main>
  )
}
