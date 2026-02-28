export type SourceType = 'official' | 'media' | 'community' | 'papers'

export type SourceItem = {
  title: string
  url: string
  publishedAt: string
  sourceName: string
  sourceType: SourceType
  snippet?: string
  hnPoints?: number
  hnComments?: number
}

export type SourceConfig = {
  id: string
  name: string
  type: SourceType
  fetchLatest: () => Promise<SourceItem[]>
}

export type ParsedRssItem = {
  title: string
  url: string
  publishedAt: string
  snippet?: string
}

export type ArticleContext = {
  url: string
  title?: string
  excerpt?: string
  text: string
}

export type CandidateItem = SourceItem & {
  normalizedUrl: string
  normalizedTitle: string
  tokens: string[]
  entities: string[]
  clusterId?: string
  clusterSize?: number
  score?: number
}

export type CandidateCluster = {
  id: string
  label: string
  items: CandidateItem[]
}
