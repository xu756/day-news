export type FetchJsonOptions = {
  timeoutMs?: number
  retries?: number
  headers?: Record<string, string>
}

const DEFAULT_TIMEOUT_MS = 12000
const DEFAULT_RETRIES = 2

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  options: FetchJsonOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retries = options.retries ?? DEFAULT_RETRIES

  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(input, {
        ...init,
        headers: {
          'user-agent':
            'day-news-digest-bot/1.0 (+https://github.com/; AI digest generator)',
          ...(options.headers ?? {}),
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) {
          await sleep(250 * (attempt + 1))
          continue
        }

        throw new Error(`HTTP ${response.status} for ${input}`)
      }

      return response
    } catch (error) {
      clearTimeout(timer)
      lastError = error

      if (attempt === retries) {
        break
      }

      await sleep(250 * (attempt + 1))
    }
  }

  throw new Error(
    `Request failed for ${input}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
  options?: FetchJsonOptions,
): Promise<T> {
  const response = await fetchWithRetry(input, init, options)
  return (await response.json()) as T
}

export async function fetchText(
  input: string,
  init?: RequestInit,
  options?: FetchJsonOptions,
): Promise<string> {
  const response = await fetchWithRetry(input, init, options)
  return response.text()
}
