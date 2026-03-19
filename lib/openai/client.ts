import { createOpenAI } from '@ai-sdk/openai'

// AI SDK provider — uses the OpenAI Responses API
export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper to get a model via the Responses API (not Chat Completions)
export function getModel(modelId: string) {
  return openaiProvider.responses(modelId)
}
