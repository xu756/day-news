export function ensureLlmEnv(): void {
  if (!process.env.LLM_API_KEY) {
    throw new Error('Missing LLM_API_KEY environment variable')
  }
}
