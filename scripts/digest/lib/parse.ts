import { Readability } from '@mozilla/readability'
import { load } from 'cheerio'
import { JSDOM } from 'jsdom'
import { fetchText } from './fetch'
import type { ArticleContext, ParsedRssItem } from './types'

const MAX_ARTICLE_CONTEXT_CHARS = 7000
const MIN_EXTRACTED_ARTICLE_CHARS = 350

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function toAbsoluteUrl(url: string, baseUrl?: string): string | null {
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return null
  }
}

function stripHtml(value: string): string {
  const $ = load(`<body>${value}</body>`)
  return normalizeWhitespace($('body').text())
}

function getPublishedAt(raw?: string): string {
  if (!raw) return new Date().toISOString()
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString()
}

export function parseRssFeed(xml: string, baseUrl?: string): ParsedRssItem[] {
  const $ = load(xml, { xmlMode: true })
  const entries = [...$('item').toArray(), ...$('entry').toArray()]

  const seenUrls = new Set<string>()
  const items: ParsedRssItem[] = []

  for (const entry of entries) {
    const node = $(entry)
    const title = normalizeWhitespace(node.find('title').first().text())

    const linkFromHref = node.find('link').attr('href')
    const linkFromText = normalizeWhitespace(node.find('link').first().text())
    const linkFromGuid = normalizeWhitespace(node.find('guid').first().text())
    const urlCandidate = linkFromHref || linkFromText || linkFromGuid

    const url = toAbsoluteUrl(urlCandidate, baseUrl)
    if (!title || !url || seenUrls.has(url)) continue

    const rawDescription =
      node.find('description').first().text() ||
      node.find('summary').first().text() ||
      node.find('content').first().text()

    items.push({
      title,
      url,
      publishedAt: getPublishedAt(
        node.find('pubDate').first().text() ||
          node.find('published').first().text() ||
          node.find('updated').first().text(),
      ),
      snippet: rawDescription ? stripHtml(rawDescription) : undefined,
    })

    seenUrls.add(url)
  }

  return items
}

function extractFallbackArticleText(html: string): string {
  const $ = load(html)
  const text =
    $('main').first().text() ||
    $('article').first().text() ||
    $('[role="main"]').first().text() ||
    $('body').text()
  return normalizeWhitespace(text)
}

function truncate(value: string, maxChars = MAX_ARTICLE_CONTEXT_CHARS): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}...`
}

export function extractArticleText(html: string, pageUrl: string): ArticleContext {
  try {
    const dom = new JSDOM(html, { url: pageUrl })
    const parsed = new Readability(dom.window.document).parse()

    if (parsed?.textContent) {
      return {
        url: pageUrl,
        title: parsed.title ?? undefined,
        excerpt: parsed.excerpt ?? undefined,
        text: truncate(normalizeWhitespace(parsed.textContent)),
      }
    }
  } catch {
    // Fall through to simple extraction.
  }

  const fallbackText = extractFallbackArticleText(html)

  return {
    url: pageUrl,
    text: truncate(fallbackText),
  }
}

async function renderWithPlaywright(url: string): Promise<string | null> {
  try {
    const playwright = await import('playwright')
    const browser = await playwright.chromium.launch({
      headless: true,
    })

    try {
      const page = await browser.newPage()
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      })
      await page.waitForTimeout(1500)
      return await page.content()
    } finally {
      await browser.close()
    }
  } catch {
    return null
  }
}

export async function fetchArticleContext(
  url: string,
  options?: {
    allowBrowserFallback?: boolean
    maxChars?: number
  },
): Promise<ArticleContext> {
  const html = await fetchText(url, undefined, {
    timeoutMs: 20000,
    retries: 2,
  })

  let extracted = extractArticleText(html, url)

  if (
    (options?.allowBrowserFallback ?? true) &&
    extracted.text.length < MIN_EXTRACTED_ARTICLE_CHARS
  ) {
    const renderedHtml = await renderWithPlaywright(url)
    if (renderedHtml) {
      extracted = extractArticleText(renderedHtml, url)
    }
  }

  return {
    ...extracted,
    text: truncate(extracted.text, options?.maxChars),
  }
}
