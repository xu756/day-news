import { Link, createFileRoute } from '@tanstack/react-router'
import { allDigests } from 'content-collections'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '#/lib/site'

const canonical = `${SITE_URL}/digest`
const pageTitle = `Digest | ${SITE_TITLE}`
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/lagoon-1.svg`
const LOOKBACK_DAYS = 14

export const Route = createFileRoute('/digest/')({
  head: () => ({
    links: [{ rel: 'canonical', href: canonical }],
    meta: [
      { title: pageTitle },
      {
        name: 'description',
        content: `Daily AI digest with traceable source links. ${SITE_DESCRIPTION}`,
      },
      { property: 'og:image', content: DEFAULT_OG_IMAGE },
    ],
  }),
  component: DigestIndex,
})

function getDateGroupLabel(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function DigestIndex() {
  const lookbackStart = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000

  const recent = [...allDigests]
    .sort(
      (a, b) =>
        new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf(),
    )
    .filter((item) => new Date(item.pubDate).valueOf() >= lookbackStart)

  const groupedByDay = Array.from(
    recent.reduce(
      (map, item) => {
        const day = item.pubDate.slice(0, 10)
        const current = map.get(day) ?? []
        current.push(item)
        map.set(day, current)
        return map
      },
      new Map<string, typeof recent>(),
    ),
  )

  return (
    <main className="page-wrap px-4 pb-12 pt-14">
      <section className="mb-6">
        <p className="island-kicker mb-2">AI News Briefing</p>
        <h1 className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          Daily Digest
        </h1>
        <p className="mb-0 mt-3 max-w-3xl text-sm text-[var(--sea-ink-soft)] sm:text-base">
          Latest 14 days, 3 stories per day, with source links for traceability.
        </p>
      </section>

      {groupedByDay.length === 0 ? (
        <section className="island-shell rounded-2xl p-6">
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            No digest entries yet. Run <code>bun run digest:generate</code> to
            create today&apos;s files.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {groupedByDay.map(([day, items]) => (
            <section key={day} className="space-y-3">
              <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                {getDateGroupLabel(`${day}T00:00:00.000Z`)}
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                {items.slice(0, 3).map((item, index) => (
                  <article
                    key={item.slug}
                    className="island-shell rise-in rounded-2xl p-5"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    {item.heroImage ? (
                      <img
                        src={item.heroImage}
                        alt=""
                        className="mb-4 h-40 w-full rounded-xl object-cover"
                      />
                    ) : null}
                    <p className="island-kicker mb-2">{item.category}</p>
                    <h3 className="m-0 text-xl font-semibold text-[var(--sea-ink)]">
                      <Link
                        to="/digest/$slug"
                        params={{ slug: item.slug }}
                        className="no-underline"
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <p className="mb-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
