import { z } from 'zod'
import { fetchWithRetry } from './fetch'
import type { SourceType } from './types'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4.1-mini'

const PICK_STORIES_SYSTEM_PROMPT = `
You are an editor for an AI daily digest.

Task:
1) Pick exactly 3 stories from candidate items.
2) Prioritize: first-party official sources, high recency, broad impact, and traceable links.
3) Keep neutral tone and fact-based reasoning.
4) Return JSON only. No markdown.

Output JSON shape:
{
  "stories": [
    {
      "headline": "string",
      "category": "string",
      "why": "string",
      "relatedUrls": ["https://..."]
    }
  ]
}
`.trim()

const WRITE_MDX_SYSTEM_PROMPT = `
You write concise AI digest posts in Chinese with neutral factual tone.

Rules:
1) No emotional language, no speculation beyond sources.
2) Use only provided context and source links.
3) Structure the article with short sections and bullet points when useful.
4) End bodyMarkdown with a "## Sources" section and bullet list of source URLs.
5) Return JSON only. No markdown fences.

Output JSON shape:
{
  "title": "string",
  "description": "string",
  "bodyMarkdown": "string",
  "category": "string",
  "sourceUrls": ["https://..."],
  "heroImage": "https://... optional"
}
`.trim()

const storySchema = z.object({
  headline: z.string().min(8).max(160),
  category: z.string().min(2).max(64),
  why: z.string().min(8).max(240),
  relatedUrls: z.array(z.string().url()).min(1).max(8),
})

const pickStoriesResponseSchema = z.object({
  stories: z.array(storySchema).length(3),
})

const writeStoryResponseSchema = z.object({
  title: z.string().min(8).max(160),
  description: z.string().min(16).max(260),
  bodyMarkdown: z.string().min(120),
  category: z.string().min(2).max(64),
  sourceUrls: z.array(z.string().url()).min(1),
  heroImage: z.string().url().optional(),
})

export type StoryCandidate = {
  title: string
  url: string
  sourceName: string
  sourceType: SourceType
  snippet?: string
  score: number
  publishedAt: string
}

export type PickedStory = z.infer<typeof storySchema>

export type RelatedStoryContext = {
  title: string
  url: string
  sourceName: string
  sourceType: SourceType
  publishedAt: string
  snippet?: string
  text?: string
}

export type WrittenStory = z.infer<typeof writeStoryResponseSchema>

type ChatCompletionPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
}

function ensureEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name} environment variable`)
  }
  return value
}

function getLlmConfig(): {
  baseUrl: string
  apiKey: string
  model: string
} {
  const apiKey = ensureEnv('LLM_API_KEY')
  const baseUrl = (process.env.LLM_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(
    /\/$/,
    '',
  )
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL

  return { baseUrl, apiKey, model }
}

function extractTextContent(payload: ChatCompletionPayload): string {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? '')
      .join('\n')
      .trim()
  }

  return ''
}

function extractJson(content: string): unknown {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model output is not valid JSON')
  }
  const raw = content.slice(start, end + 1)
  return JSON.parse(raw)
}

async function callChatJson<T>(
  prompt: string,
  systemPrompt: string,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const { baseUrl, apiKey, model } = getLlmConfig()

  const response = await fetchWithRetry(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        top_p: 0.9,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    },
    {
      timeoutMs: 45000,
      retries: 2,
    },
  )

  const payload = (await response.json()) as ChatCompletionPayload
  const text = extractTextContent(payload)
  if (!text) {
    throw new Error('Model returned empty content')
  }

  const json = extractJson(text)
  return schema.parse(json)
}

function pickStoriesFallback(candidates: StoryCandidate[]): PickedStory[] {
  return candidates.slice(0, 3).map((candidate) => ({
    headline: candidate.title,
    category: candidate.sourceType === 'official' ? 'Official Updates' : 'Industry',
    why: 'High score based on source quality, recency, and cross-source relevance.',
    relatedUrls: [candidate.url],
  }))
}

function appendSourcesSection(bodyMarkdown: string, sourceUrls: string[]): string {
  if (/\n##\s+Sources/i.test(bodyMarkdown)) {
    return bodyMarkdown
  }

  const sources = sourceUrls.map((url) => `- ${url}`).join('\n')
  return `${bodyMarkdown.trim()}\n\n## Sources\n${sources}\n`
}

export async function pickStories(
  candidates: StoryCandidate[],
): Promise<PickedStory[]> {
  if (candidates.length === 0) {
    throw new Error('No candidates provided for story selection')
  }

  const ranked = [...candidates].sort((a, b) => b.score - a.score).slice(0, 20)

  const prompt = `
Candidate stories (JSON):
${JSON.stringify(ranked, null, 2)}

Select exactly 3 stories for today's digest.
- Use only urls present in candidate items.
- Each story should have 2-5 relatedUrls when possible.
- Keep category short and reusable.
`.trim()

  try {
    const result = await callChatJson(
      prompt,
      PICK_STORIES_SYSTEM_PROMPT,
      pickStoriesResponseSchema,
    )

    const validUrlSet = new Set(ranked.map((item) => item.url))
    const sanitized = result.stories.map((story) => ({
      ...story,
      relatedUrls: [...new Set(story.relatedUrls)].filter((url) =>
        validUrlSet.has(url),
      ),
    }))

    if (sanitized.some((story) => story.relatedUrls.length === 0)) {
      return pickStoriesFallback(ranked)
    }

    return sanitized
  } catch {
    return pickStoriesFallback(ranked)
  }
}

export async function writeMdx(
  story: PickedStory,
  contexts: RelatedStoryContext[],
): Promise<WrittenStory> {
  const prompt = `
Story to write:
${JSON.stringify(story, null, 2)}

Related source contexts:
${JSON.stringify(contexts, null, 2)}

Write one digest post in Chinese based on the inputs.
`.trim()

  const result = await callChatJson(
    prompt,
    WRITE_MDX_SYSTEM_PROMPT,
    writeStoryResponseSchema,
  )

  const fallbackSources =
    result.sourceUrls.length > 0 ? result.sourceUrls : story.relatedUrls

  return {
    ...result,
    sourceUrls: [...new Set(fallbackSources)],
    bodyMarkdown: appendSourcesSection(result.bodyMarkdown, fallbackSources),
  }
}
