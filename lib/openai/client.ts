import { createOpenAI } from '@ai-sdk/openai'

// AI SDK provider — use this in route handlers with streamText / generateObject
export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper to get a model by name
export function getModel(modelId: string) {
  return openaiProvider(modelId)
}
