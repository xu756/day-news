import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const BASE_URL = 'http://127.0.0.1:4173'
const DIST_DIR = join(process.cwd(), 'dist')

let browser: Browser | null = null
let server: Server | null = null

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
}

function contentType(filePath: string): string {
  return MIME_TYPES[extname(filePath)] || 'application/octet-stream'
}

async function serveFile(pathname: string): Promise<{ body: Buffer; type: string }> {
  const sanitized = normalize(pathname).replace(/^\/+/, '')
  const targetPath = join(DIST_DIR, sanitized)

  try {
    const body = await readFile(targetPath)
    return { body, type: contentType(targetPath) }
  } catch {
    const indexPath = join(DIST_DIR, 'index.html')
    const body = await readFile(indexPath)
    return { body, type: contentType(indexPath) }
  }
}

async function withPage(fn: (page: Page) => Promise<void>): Promise<void> {
  if (!browser) throw new Error('Browser not initialized')
  const page = await browser.newPage({ viewport: { width: 1365, height: 2200 } })
  try {
    await fn(page)
  } finally {
    await page.close()
  }
}

describe('digest playwright smoke', () => {
  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const pathname = request.url ? new URL(request.url, BASE_URL).pathname : '/'
      const { body, type } = await serveFile(pathname)
      response.writeHead(200, { 'content-type': type })
      response.end(body)
    })

    await new Promise<void>((resolve, reject) => {
      server?.listen(4173, '127.0.0.1', () => resolve())
      server?.on('error', reject)
    })

    browser = await chromium.launch({ headless: true })
  }, 60_000)

  afterAll(async () => {
    if (browser) {
      await browser.close()
      browser = null
    }

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
      server = null
    }
  })

  it('shows candidate list link on index and full candidate list on detail', async () => {
    await withPage(async (page) => {
      await page.goto(`${BASE_URL}/digest`, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      })

      const candidateLink = page.getByText(/从\s*\d+\s*条资讯中筛选/).first()
      expect(await candidateLink.count()).toBeGreaterThan(0)

      const candidateText = (await candidateLink.textContent())?.trim() ?? ''
      expect(candidateText).toMatch(/从\s*\d+\s*条资讯中筛选/)

      await candidateLink.click()
      await page.waitForURL(/#candidate-list/)

      const candidateLinks = await page.locator('#candidate-list ol li a').count()
      expect(candidateLinks).toBeGreaterThan(20)
    })
  })
})
