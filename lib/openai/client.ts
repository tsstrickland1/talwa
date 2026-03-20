import { createOpenAI } from '@ai-sdk/openai'

// AI SDK provider — uses the OpenAI Responses API
export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Get a model via the Responses API.
 */
export function getModel(modelId: string) {
  return openaiProvider.responses(modelId)
}
