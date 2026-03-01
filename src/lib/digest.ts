import { allDigests } from 'content-collections'
import yaml from 'js-yaml'

export type DigestPost = (typeof allDigests)[number]
export type DigestDay = {
  day: string
  posts: DigestPost[]
  lead: DigestPost
}

export type DigestSourceItem = {
  title: string
  url: string
  sourceNames: string[]
  sourceTypes: string[]
  score?: number
  mentions: number
}

type DigestSourceRecord = {
  date: string
  candidateCount: number
  featured: DigestSourceItem[]
  all: DigestSourceItem[]
}

export type DigestDayConfig = {
  date: string
  coverImage?: string
  coverAlt?: string
}

type DigestDayDataRecord = DigestDayConfig & {
  candidateCount?: number
  featured?: DigestSourceItem[]
  all?: DigestSourceItem[]
}

const digestDataModules = import.meta.glob('../../content/digest/*/data.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
})

function dayFromUnknown(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 10)
  }

  return null
}

function loadYamlObject(rawInput: unknown): Record<string, unknown> | null {
  const raw =
    typeof rawInput === 'string'
      ? rawInput
      : ((rawInput as { default?: string })?.default ?? '')

  if (!raw.trim()) return null

  try {
    const parsed = yaml.load(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function parseDayData(rawInput: unknown): DigestDayDataRecord | null {
  const parsed = loadYamlObject(rawInput)
  if (!parsed) return null

  const date = dayFromUnknown(parsed.date)
  if (!date) return null

  const coverImage =
    typeof parsed.coverImage === 'string' && parsed.coverImage.trim()
      ? parsed.coverImage.trim()
      : undefined

  const coverAlt =
    typeof parsed.coverAlt === 'string' && parsed.coverAlt.trim()
      ? parsed.coverAlt.trim()
      : undefined

  const candidateCountRaw = Number(parsed.candidateCount)
  const candidateCount = Number.isFinite(candidateCountRaw)
    ? candidateCountRaw
    : undefined

  return {
    date,
    coverImage,
    coverAlt,
    candidateCount,
    featured: Array.isArray(parsed.featured)
      ? (parsed.featured as DigestSourceItem[])
      : undefined,
    all: Array.isArray(parsed.all)
      ? (parsed.all as DigestSourceItem[])
      : undefined,
  }
}

const digestDayData = Object.values(digestDataModules)
  .map((moduleItem) => parseDayData(moduleItem))
  .filter((payload): payload is DigestDayDataRecord => Boolean(payload?.date))

function dayFromIso(iso: string): string {
  return iso.slice(0, 10)
}

function sourceNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
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

function pushUnique(target: string[], value: string | undefined): void {
  if (!value) return
  if (!target.includes(value)) target.push(value)
}

function buildDigestSourceItems(
  entries: Array<{
    title: string
    url: string
    sourceName?: string
    sourceType?: string
    score?: number
  }>,
): DigestSourceItem[] {
  const byUrl = new Map<string, DigestSourceItem>()

  for (const entry of entries) {
    const key = normalizeUrl(entry.url)
    const current = byUrl.get(key)

    if (current) {
      pushUnique(
        current.sourceNames,
        entry.sourceName || sourceNameFromUrl(entry.url),
      )
      pushUnique(current.sourceTypes, entry.sourceType)
      current.mentions += 1
      if (typeof entry.score === 'number') {
        current.score =
          typeof current.score === 'number'
            ? Math.max(current.score, entry.score)
            : entry.score
      }
      continue
    }

    byUrl.set(key, {
      title: entry.title,
      url: entry.url,
      sourceNames: [entry.sourceName || sourceNameFromUrl(entry.url)],
      sourceTypes: entry.sourceType ? [entry.sourceType] : [],
      score: entry.score,
      mentions: 1,
    })
  }

  return Array.from(byUrl.values()).sort((a, b) => {
    const scoreA = typeof a.score === 'number' ? a.score : -1
    const scoreB = typeof b.score === 'number' ? b.score : -1
    if (scoreA !== scoreB) return scoreB - scoreA
    if (a.mentions !== b.mentions) return b.mentions - a.mentions
    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

export function getDigestDays(): DigestDay[] {
  const grouped = new Map<string, DigestPost[]>()

  for (const post of allDigests) {
    const day = dayFromIso(post.pubDate)
    const current = grouped.get(day) ?? []
    current.push(post)
    grouped.set(day, current)
  }

  return Array.from(grouped.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, posts]) => {
      const sorted = [...posts].sort((a, b) => a.slug.localeCompare(b.slug))
      return {
        day,
        posts: sorted,
        lead: sorted[0],
      }
    })
}

export function findDigestDayBySlug(slug: string): DigestDay | null {
  return (
    getDigestDays().find((day) =>
      day.posts.some((post) => post.slug === slug),
    ) ?? null
  )
}

function asSourceRecord(
  dayData: DigestDayDataRecord,
): DigestSourceRecord | null {
  if (
    typeof dayData.candidateCount === 'number' &&
    Array.isArray(dayData.featured) &&
    Array.isArray(dayData.all)
  ) {
    return {
      date: dayData.date,
      candidateCount: dayData.candidateCount,
      featured: dayData.featured,
      all: dayData.all,
    }
  }

  return null
}

export function getSourcesForDay(day: string, posts: DigestPost[]) {
  const dayData = digestDayData.find((item) => item.date === day)
  const sourceRecord = dayData ? asSourceRecord(dayData) : null

  if (sourceRecord) {
    return {
      candidateCount: sourceRecord.candidateCount,
      featured: sourceRecord.featured,
      all: sourceRecord.all,
    }
  }

  const fallbackCandidates = posts.flatMap((post) => post.candidateItems ?? [])
  const fallbackAll = buildDigestSourceItems(fallbackCandidates)

  return {
    candidateCount: Math.max(posts[0]?.candidateCount ?? 0, fallbackAll.length),
    featured: fallbackAll.slice(0, 9),
    all: fallbackAll,
  }
}

export function getDayConfig(day: string): DigestDayConfig | undefined {
  const dayData = digestDayData.find((item) => item.date === day)
  if (!dayData) return undefined

  return {
    date: dayData.date,
    coverImage: dayData.coverImage,
    coverAlt: dayData.coverAlt,
  }
}

export function formatZhDateLabel(isoOrDay: string): string {
  const normalized =
    isoOrDay.length === 10 ? `${isoOrDay}T00:00:00.000Z` : isoOrDay

  return new Date(normalized).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
