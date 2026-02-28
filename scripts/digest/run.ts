import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { clusterCandidates, dedupeCandidates, normalizeUrl } from './lib/dedupe'
import type {
  PickedStory,
  RelatedStoryContext,
  StoryCandidate,
  WrittenStory,
} from './lib/llm'
import { assertLlmConfigured, pickStories, writeMdx } from './lib/llm'
import { findFirstOgImage, generateCoverImageIfEnabled } from './lib/ogImage'
import { fetchArticleContext } from './lib/parse'
import { scoreCandidates } from './lib/score'
import type { CandidateItem, SourceType } from './lib/types'
import { fetchAllSources } from './sources'

const DEFAULT_TIMEZONE = process.env.DIGEST_TIMEZONE || 'Asia/Shanghai'
const STORIES_PER_DAY = 3

type DigestSource = {
  name: string
  url: string
  sourceType?: SourceType
}

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

function sourceNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Unknown Source'
  }
}

function buildFallbackArticle(
  story: PickedStory,
  contexts: RelatedStoryContext[],
): WrittenStory {
  const summaryItems = contexts.slice(0, 4).map((context) => {
    const publishedAt = new Date(context.publishedAt).toLocaleDateString('zh-CN')
    const snippet = context.snippet || context.text || '原文未提供摘要。'
    return `- **${context.sourceName}**（${publishedAt}）：${snippet.slice(0, 180)}`
  })

  const sourceUrls = uniqueUrls([
    ...story.relatedUrls,
    ...contexts.map((item) => item.url),
  ]).slice(0, 8)

  return {
    title: story.headline,
    description: `${story.headline}：基于英文一手来源的当日摘要。`,
    category: story.category,
    sourceUrls,
    bodyMarkdown: [
      '## 核心信息',
      story.why,
      '',
      '## 关键信号',
      ...(summaryItems.length > 0
        ? summaryItems
        : ['- 暂无可用摘要，建议查看来源原文。']),
      '',
      '## Sources',
      ...sourceUrls.map((url) => `- ${url}`),
    ].join('\n'),
  }
}

function toDigestSources(params: {
  sourceUrls: string[]
  contexts: RelatedStoryContext[]
  candidateByUrl: Map<string, CandidateItem>
}): DigestSource[] {
  const contextByUrl = new Map<string, RelatedStoryContext>()
  for (const item of params.contexts) {
    contextByUrl.set(normalizeUrl(item.url), item)
  }

  return params.sourceUrls.map((url) => {
    const normalized = normalizeUrl(url)
    const context = contextByUrl.get(normalized)
    const candidate = params.candidateByUrl.get(normalized)

    return {
      name:
        context?.sourceName ||
        candidate?.sourceName ||
        sourceNameFromUrl(url),
      url,
      sourceType: context?.sourceType || candidate?.sourceType,
    }
  })
}

function buildFrontmatter(params: {
  title: string
  description: string
  pubDate: string
  category: string
  why: string
  candidateCount: number
  sourceUrls: string[]
  sources: DigestSource[]
  heroImage?: string
}): string {
  const sourceUrlBlock = params.sourceUrls.length
    ? ['sourceUrls:', ...params.sourceUrls.map((url) => `  - ${toYamlString(url)}`)]
    : ['sourceUrls: []']

  const sourcesBlock = params.sources.length
    ? [
        'sources:',
        ...params.sources.flatMap((source) => {
          const lines = [
            `  - name: ${toYamlString(source.name)}`,
            `    url: ${toYamlString(source.url)}`,
          ]

          if (source.sourceType) {
            lines.push(`    sourceType: ${toYamlString(source.sourceType)}`)
          }

          return lines
        }),
      ]
    : []

  return [
    '---',
    `title: ${toYamlString(params.title)}`,
    `description: ${toYamlString(params.description)}`,
    `pubDate: ${toYamlString(params.pubDate)}`,
    `category: ${toYamlString(params.category)}`,
    `why: ${toYamlString(params.why)}`,
    `candidateCount: ${params.candidateCount}`,
    ...sourceUrlBlock,
    ...sourcesBlock,
    params.heroImage ? `heroImage: ${toYamlString(params.heroImage)}` : '',
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
  why: string
  candidateCount: number
  sourceUrls: string[]
  sources: DigestSource[]
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

async function cleanupExistingDailyFiles(targetDir: string): Promise<void> {
  try {
    const files = await readdir(targetDir)
    const targets = files.filter((file) => /^[0-9]{2}-.+\.mdx?$/.test(file))

    await Promise.all(
      targets.map(async (file) => {
        await unlink(path.join(targetDir, file))
      }),
    )
  } catch {
    // Ignore missing directory.
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  assertLlmConfigured()

  const date = getTodayInTimezone(DEFAULT_TIMEZONE)
  const targetDir = path.join(process.cwd(), 'content', 'digest', date)

  if (await shouldSkip(targetDir, force)) {
    console.log(
      `[digest] ${date} already has ${STORIES_PER_DAY} files, skipping (use --force to regenerate)`,
    )
    return
  }

  if (force) {
    await cleanupExistingDailyFiles(targetDir)
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
    category: 'AI 产业动态',
    why: '按来源权重、时效性与多源交叉评分自动入选。',
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
    let article: WrittenStory

    try {
      article = await writeMdx(story, contexts)
    } catch (error) {
      console.warn(
        `[digest] writeMdx fallback for \"${story.headline}\": ${error instanceof Error ? error.message : String(error)}`,
      )
      article = buildFallbackArticle(story, contexts)
    }

    const sourceUrls = uniqueUrls([...article.sourceUrls, ...story.relatedUrls]).slice(0, 8)
    const sources = toDigestSources({
      sourceUrls,
      contexts,
      candidateByUrl,
    })

    const coverByModel = await generateCoverImageIfEnabled({
      title: article.title,
      category: article.category || story.category,
      why: story.why,
      date,
      index,
    })

    const heroImage =
      coverByModel ?? article.heroImage ?? (await findFirstOgImage(sourceUrls))

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
      why: story.why,
      candidateCount: scored.length,
      sourceUrls,
      sources,
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
