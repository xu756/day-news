import { promises as fs } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import yaml from 'js-yaml'

const ROOT = process.cwd()
const DIGEST_DIR = path.join(ROOT, 'content', 'digest')

async function walkMdx(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkMdx(fullPath)))
      continue
    }

    if (entry.isFile() && fullPath.endsWith('.mdx')) {
      files.push(fullPath)
    }
  }

  return files
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

function sourceNameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function pickByScore(current, next) {
  const currentScore = typeof current.score === 'number' ? current.score : -1
  const nextScore = typeof next.score === 'number' ? next.score : -1
  return nextScore > currentScore ? next : current
}

function buildSourcePayload(day, candidates, candidateCount) {
  const byUrl = new Map()

  for (const candidate of candidates) {
    const key = normalizeUrl(candidate.url)
    const existing = byUrl.get(key)

    if (!existing) {
      byUrl.set(key, {
        title: candidate.title,
        url: candidate.url,
        sourceNames: [candidate.sourceName || sourceNameFromUrl(candidate.url)],
        sourceTypes: candidate.sourceType ? [candidate.sourceType] : [],
        score: candidate.score,
        mentions: 1,
      })
      continue
    }

    const preferred = pickByScore(existing, candidate)
    existing.title = preferred.title
    existing.url = preferred.url

    const sourceName = candidate.sourceName || sourceNameFromUrl(candidate.url)
    if (!existing.sourceNames.includes(sourceName)) {
      existing.sourceNames.push(sourceName)
    }

    if (
      candidate.sourceType &&
      !existing.sourceTypes.includes(candidate.sourceType)
    ) {
      existing.sourceTypes.push(candidate.sourceType)
    }

    existing.mentions += 1

    if (typeof candidate.score === 'number') {
      existing.score =
        typeof existing.score === 'number'
          ? Math.max(existing.score, candidate.score)
          : candidate.score
    }
  }

  const all = Array.from(byUrl.values()).sort((a, b) => {
    const scoreA = typeof a.score === 'number' ? a.score : -1
    const scoreB = typeof b.score === 'number' ? b.score : -1

    if (scoreA !== scoreB) return scoreB - scoreA
    if (a.mentions !== b.mentions) return b.mentions - a.mentions
    return a.title.localeCompare(b.title, 'zh-CN')
  })

  return {
    date: day,
    candidateCount: Math.max(candidateCount, all.length),
    featured: all.slice(0, 9),
    all,
  }
}

async function loadYamlObject(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = yaml.load(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function readExistingDayData(day, outputDir) {
  const dataPath = path.join(outputDir, 'data.yaml')
  const configPath = path.join(outputDir, 'config.yaml')
  const sourcesPath = path.join(outputDir, 'sources.yaml')

  const [dataObj, configObj, sourcesObj] = await Promise.all([
    loadYamlObject(dataPath),
    loadYamlObject(configPath),
    loadYamlObject(sourcesPath),
  ])

  const merged = {
    date: day,
    coverImage: '',
    coverAlt: `${day} AI资讯速览封面`,
    ...dataObj,
    ...configObj,
    ...sourcesObj,
  }

  if (typeof merged.coverImage !== 'string') {
    merged.coverImage = ''
  }

  if (typeof merged.coverAlt !== 'string' || !merged.coverAlt.trim()) {
    merged.coverAlt = `${day} AI资讯速览封面`
  }

  merged.date = day

  return merged
}

async function cleanupLegacyFiles(outputDir) {
  const legacyFiles = ['config.yaml', 'sources.yaml', 'sources.json']

  await Promise.all(
    legacyFiles.map(async (fileName) => {
      const filePath = path.join(outputDir, fileName)
      try {
        await fs.unlink(filePath)
      } catch {
        // Ignore missing files.
      }
    }),
  )
}

const files = await walkMdx(DIGEST_DIR)
const byDay = new Map()

for (const file of files) {
  const raw = await fs.readFile(file, 'utf-8')
  const parsed = matter(raw)
  const date = String(parsed.data.pubDate || '').slice(0, 10)

  if (!date) continue

  const candidateItems = Array.isArray(parsed.data.candidateItems)
    ? parsed.data.candidateItems
    : []

  const dayGroup = byDay.get(date) || {
    candidates: [],
    candidateCount: 0,
  }

  dayGroup.candidates.push(...candidateItems)
  dayGroup.candidateCount = Math.max(
    dayGroup.candidateCount,
    Number(parsed.data.candidateCount || 0),
  )
  byDay.set(date, dayGroup)

  if (candidateItems.length > 0) {
    delete parsed.data.candidateItems
    parsed.data.sourceDate = date

    const nextFrontmatter = yaml.dump(parsed.data, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })

    const nextRaw = `---\n${nextFrontmatter}---\n${parsed.content}`
    await fs.writeFile(file, nextRaw, 'utf-8')
  }
}

for (const [day, group] of byDay.entries()) {
  const sourcePayload = buildSourcePayload(
    day,
    group.candidates,
    group.candidateCount,
  )
  const outputDir = path.join(DIGEST_DIR, day)
  await fs.mkdir(outputDir, { recursive: true })

  const existing = await readExistingDayData(day, outputDir)
  const nextData = {
    ...existing,
    date: day,
    candidateCount: sourcePayload.candidateCount,
    featured: sourcePayload.featured,
    all: sourcePayload.all,
  }

  const outputPath = path.join(outputDir, 'data.yaml')
  const dataYaml = yaml.dump(nextData, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  })

  await fs.writeFile(outputPath, dataYaml, 'utf-8')
  await cleanupLegacyFiles(outputDir)
  console.log(`wrote ${path.relative(ROOT, outputPath)}`)
}
