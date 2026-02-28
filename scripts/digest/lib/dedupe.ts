import type { SourceItem } from './types'

export function dedupeByUrl(items: SourceItem[]): SourceItem[] {
  const seen = new Set<string>()
  const result: SourceItem[] = []

  for (const item of items) {
    const key = item.url.trim()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}
