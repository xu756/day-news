import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { clusterCandidates, dedupeCandidates, normalizeUrl } from './lib/dedupe'
import type { PickedStory, RelatedStoryContext, StoryCandidate } from './lib/llm'
import { pickStories, writeMdx } from './lib/llm'
import { findFirstOgImage } from './lib/ogImage'
import { fetchArticleContext } from './lib/parse'
import { scoreCandidates } from './lib/score'
import type { CandidateItem } from './lib/types'
import { fetchAllSources } from './sources'

const DEFAULT_TIMEZONE = process.env.DIGEST_TIMEZONE || 'Asia/Shanghai'
const STORIES_PER_DAY = 3

function getTodayInTimezone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  return slug || 'ai-digest-story'
}

function toStoryCandidates(items: CandidateItem[]): StoryCandidate[] {
  return items.slice(0, 20).map((item) => ({
    title: item.title,
    url: item.url,
    sourceName: item.sourceName,
    sourceType: item.sourceType,
    snippet: item.snippet,
    score: item.score ?? 0,
    publishedAt: item.publishedAt,
  }))
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const url of urls) {
    const normalized = normalizeUrl(url)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(url)
  }

  return result
}

function toYamlString(value: string): string {
  return JSON.stringify(value)
}

function buildFrontmatter(params: {
  title: string
  description: string
  pubDate: string
  category: string
  sourceUrls: string[]
  heroImage?: string
}): string {
  const sourceLines = params.sourceUrls
    .map((url) => `  - ${toYamlString(url)}`)
    .join('\n')

  const heroImageLine = params.heroImage
    ? `heroImage: ${toYamlString(params.heroImage)}\n`
    : ''

  return [
    '---',
    `title: ${toYamlString(params.title)}`,
    `description: ${toYamlString(params.description)}`,
    `pubDate: ${toYamlString(params.pubDate)}`,
    `category: ${toYamlString(params.category)}`,
    `sourceUrls:`,
    sourceLines,
    heroImageLine.trimEnd(),
    '---',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildMdxFile(params: {
  title: string
  description: string
  pubDate: string
  category: string
  sourceUrls: string[]
  heroImage?: string
  bodyMarkdown: string
}): string {
  return `${buildFrontmatter(params)}\n\n${params.bodyMarkdown.trim()}\n`
}

async function getContextForStory(
  story: PickedStory,
  candidateByUrl: Map<string, CandidateItem>,
): Promise<RelatedStoryContext[]> {
  const relatedCandidates = story.relatedUrls
    .map((url) => candidateByUrl.get(normalizeUrl(url)))
    .filter((item): item is CandidateItem => item !== undefined)

  const contexts = await Promise.all(
    relatedCandidates.map(async (item) => {
      try {
        const extracted = await fetchArticleContext(item.url, {
          maxChars: 6000,
          allowBrowserFallback: true,
        })

        return {
          title: item.title,
          url: item.url,
          sourceName: item.sourceName,
          sourceType: item.sourceType,
          publishedAt: item.publishedAt,
          snippet: extracted.excerpt ?? item.snippet,
          text: extracted.text,
        } satisfies RelatedStoryContext
      } catch {
        return {
          title: item.title,
          url: item.url,
          sourceName: item.sourceName,
          sourceType: item.sourceType,
          publishedAt: item.publishedAt,
          snippet: item.snippet,
          text: item.snippet,
        } satisfies RelatedStoryContext
      }
    }),
  )

  return contexts
}

async function shouldSkip(targetDir: string, force: boolean): Promise<boolean> {
  if (force) return false

  try {
    const files = await readdir(targetDir)
    const count = files.filter((file) => /^[0-9]{2}-.+\.mdx?$/.test(file)).length
    return count >= STORIES_PER_DAY
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const date = getTodayInTimezone(DEFAULT_TIMEZONE)
  const targetDir = path.join(process.cwd(), 'content', 'digest', date)

  if (await shouldSkip(targetDir, force)) {
    console.log(
      `[digest] ${date} already has ${STORIES_PER_DAY} files, skipping (use --force to regenerate)`,
    )
    return
  }

  const rawItems = await fetchAllSources()
  if (rawItems.length === 0) {
    throw new Error('No source items fetched from configured sources')
  }

  const deduped = dedupeCandidates(rawItems)
  const clustered = clusterCandidates(deduped)
  const scored = scoreCandidates(clustered.items)

  if (scored.length === 0) {
    throw new Error('No candidates left after dedupe and scoring')
  }

  const topCandidates = toStoryCandidates(scored)
  const stories = await pickStories(topCandidates)

  const fallbackStories = topCandidates.slice(0, STORIES_PER_DAY).map((candidate) => ({
    headline: candidate.title,
    category: 'AI Updates',
    why: 'Selected by score fallback due insufficient LLM output.',
    relatedUrls: [candidate.url],
  }))

  const selectedStories = [...stories, ...fallbackStories].slice(0, STORIES_PER_DAY)

  const candidateByUrl = new Map<string, CandidateItem>()
  for (const item of scored) {
    candidateByUrl.set(item.normalizedUrl, item)
  }

  await mkdir(targetDir, { recursive: true })
  const usedNames = new Set<string>()

  for (const [index, story] of selectedStories.entries()) {
    const contexts = await getContextForStory(story, candidateByUrl)
    const article = await writeMdx(story, contexts)

    const sourceUrls = uniqueUrls([
      ...article.sourceUrls,
      ...story.relatedUrls,
    ]).slice(0, 8)

    const heroImage = article.heroImage ?? (await findFirstOgImage(sourceUrls))
    const baseSlug = slugify(article.title)
    let finalSlug = baseSlug
    let suffix = 2

    while (usedNames.has(finalSlug)) {
      finalSlug = `${baseSlug}-${suffix}`
      suffix += 1
    }
    usedNames.add(finalSlug)

    const filename = `${String(index + 1).padStart(2, '0')}-${finalSlug}.mdx`
    const outputPath = path.join(targetDir, filename)
    const mdx = buildMdxFile({
      title: article.title,
      description: article.description,
      pubDate: date,
      category: article.category || story.category,
      sourceUrls,
      heroImage,
      bodyMarkdown: article.bodyMarkdown,
    })

    await writeFile(outputPath, mdx, 'utf-8')
    console.log(`[digest] wrote ${path.relative(process.cwd(), outputPath)}`)
  }

  console.log(`[digest] completed ${date} with ${STORIES_PER_DAY} stories`)
}

void main().catch((error) => {
  console.error('[digest] failed', error)
  process.exit(1)
})
