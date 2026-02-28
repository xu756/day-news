import { load } from 'cheerio'
import { fetchText } from './fetch'

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
