import { load } from 'cheerio'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchText, fetchWithRetry } from './fetch'

function toAbsoluteUrl(url: string, baseUrl: string): string | null {
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return null
  }
}

export function extractOgImageFromHtml(
  html: string,
  pageUrl: string,
): string | null {
  const $ = load(html)

  const candidate =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('link[rel="image_src"]').attr('href')

  if (!candidate) return null
  return toAbsoluteUrl(candidate, pageUrl)
}

export async function findOgImage(url: string): Promise<string | null> {
  try {
    const html = await fetchText(url, undefined, { timeoutMs: 18000, retries: 2 })
    return extractOgImageFromHtml(html, url)
  } catch {
    return null
  }
}

export async function findFirstOgImage(
  urls: string[],
): Promise<string | undefined> {
  for (const url of urls) {
    const image = await findOgImage(url)
    if (image) {
      return image
    }
  }
  return undefined
}

function isCoverModelEnabled(): boolean {
  const raw = (process.env.DIGEST_ENABLE_COVER_MODEL || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function sanitizeFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'story'
  )
}

type ImageGenerationData = {
  b64_json?: string
  url?: string
}

type ImageGenerationResponse = {
  data?: ImageGenerationData[]
}

async function decodeImageBuffer(data: ImageGenerationData): Promise<Buffer | null> {
  if (data.b64_json) {
    return Buffer.from(data.b64_json, 'base64')
  }

  if (data.url) {
    const response = await fetchWithRetry(
      data.url,
      {
        method: 'GET',
      },
      {
        timeoutMs: 45000,
        retries: 1,
      },
    )
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  return null
}

export async function generateCoverImageIfEnabled(params: {
  title: string
  category: string
  why: string
  date: string
  index: number
}): Promise<string | undefined> {
  if (!isCoverModelEnabled()) return undefined

  const apiKey = process.env.LLM_API_KEY?.trim()
  if (!apiKey) return undefined

  const baseUrl = (process.env.LLM_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  )
  const model =
    process.env.DIGEST_COVER_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    'gpt-image-1'

  const prompt = [
    'Create a clean editorial cover image for a daily AI digest article.',
    'No brand logos, no text overlays, no people faces.',
    `Category: ${params.category}`,
    `Headline: ${params.title}`,
    `Reason: ${params.why}`,
    'Style: minimalist, neutral, factual, soft gray-green palette, subtle depth.',
  ].join('\n')

  try {
    const response = await fetchWithRetry(
      `${baseUrl}/images/generations`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          size: '1536x1024',
          quality: 'medium',
          response_format: 'b64_json',
        }),
      },
      {
        timeoutMs: 90000,
        retries: 1,
      },
    )

    const payload = (await response.json()) as ImageGenerationResponse
    const first = payload.data?.[0]
    if (!first) return undefined

    const buffer = await decodeImageBuffer(first)
    if (!buffer) return undefined

    const filename = `${String(params.index + 1).padStart(2, '0')}-${sanitizeFilename(params.title)}.png`
    const relativeDir = path.join('images', 'digest', params.date)
    const absoluteDir = path.join(process.cwd(), 'public', relativeDir)
    const absolutePath = path.join(absoluteDir, filename)

    await mkdir(absoluteDir, { recursive: true })
    await writeFile(absolutePath, buffer)

    return `/${relativeDir.replaceAll(path.sep, '/')}/${filename}`
  } catch (error) {
    console.warn(
      `[digest] cover model generation skipped: ${error instanceof Error ? error.message : String(error)}`,
    )
    return undefined
  }
}
