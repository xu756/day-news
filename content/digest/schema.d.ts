/**
 * Digest content schema reference.
 *
 * Read by app:
 * 1) Posts (via content-collections): content/digest/<YYYY-MM-DD>/*.{md,mdx}
 * 2) Day data (via import.meta.glob): content/digest/<YYYY-MM-DD>/data.yaml
 *
 * If you create files matching this structure and fields, the app can read them.
 */

export type DigestDayFolder =
  `${number}${number}${number}${number}-${number}${number}-${number}${number}`

export type DigestPostFileName =
  | `${number}${number}-${string}.md`
  | `${number}${number}-${string}.mdx`

/** Source item used in MD/MDX frontmatter `sources`. */
export interface DigestFrontmatterSource {
  name: string
  url: string
  sourceType?: string
}

/** Optional raw candidate item in MD/MDX frontmatter `candidateItems`. */
export interface DigestCandidateItem {
  title: string
  url: string
  sourceName?: string
  sourceType?: string
  score?: number
}

/** Required/optional frontmatter for each digest post file. */
export interface DigestPostFrontmatter {
  title: string
  description: string
  pubDate: string
  category: string
  content: string
  sourceUrls: string[]

  why?: string
  candidateCount?: number
  heroImage?: string
  sources?: DigestFrontmatterSource[]
  sourceDate?: string
  candidateItems?: DigestCandidateItem[]
  slug?: string
}

/** Item shape in day-level `data.yaml` (`featured` / `all`). */
export interface DigestDaySourceItem {
  title: string
  url: string
  sourceNames: string[]
  sourceTypes: string[]
  score?: number
  mentions: number
}

/** Day-level config + source summary in `data.yaml`. */
export interface DigestDayDataYaml {
  date: string
  coverImage?: string
  coverAlt?: string
  candidateCount?: number
  featured?: DigestDaySourceItem[]
  all?: DigestDaySourceItem[]
}

/**
 * Minimal files needed for one day:
 *
 * content/digest/<YYYY-MM-DD>/01-*.mdx
 * content/digest/<YYYY-MM-DD>/02-*.mdx
 * content/digest/<YYYY-MM-DD>/03-*.mdx
 * content/digest/<YYYY-MM-DD>/data.yaml
 *
 * Practical minimum fields to avoid fallback behavior:
 * - Each MDX: title, description, pubDate, category, content, sourceUrls
 * - data.yaml: date, candidateCount, featured, all
 */
