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
