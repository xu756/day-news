import { MDXContent } from '@content-collections/mdx/react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { allDigests } from 'content-collections'
import { MdxCallout } from '#/components/MdxCallout'
import { MdxMetrics } from '#/components/MdxMetrics'
import { SITE_URL } from '#/lib/site'

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
      links: [{ rel: 'canonical', href: `${SITE_URL}/digest/${canonicalSlug}` }],
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

function DigestPost() {
  const post = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-12 pt-16">
      <article className="island-shell rounded-2xl p-6 sm:p-8">
        {post.heroImage ? (
          <img
            src={post.heroImage}
            alt=""
            className="mb-6 h-64 w-full rounded-2xl object-cover"
          />
        ) : null}
        <p className="island-kicker mb-2">Digest • {post.category}</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          {post.title}
        </h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          {new Date(post.pubDate).toLocaleDateString()}
        </p>

        <div className="prose prose-slate prose-headings:text-[var(--sea-ink)] prose-p:text-[var(--sea-ink-soft)] prose-li:text-[var(--sea-ink-soft)] prose-ul:text-[var(--sea-ink-soft)] prose-ol:text-[var(--sea-ink-soft)] prose-strong:text-[var(--sea-ink)] prose-a:text-[var(--lagoon-deep)] max-w-none">
          {post.mdx ? (
            <MDXContent
              code={post.mdx}
              components={{ MdxCallout, MdxMetrics }}
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: post.html ?? '' }} />
          )}
        </div>

        <section className="mt-8 border-t border-[var(--line)] pt-5">
          <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
            Sources
          </h2>
          <ul className="mb-0 mt-3 space-y-2 pl-5 text-sm text-[var(--sea-ink-soft)]">
            {post.sourceUrls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer noopener">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  )
}
