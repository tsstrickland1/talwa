import { createOpenAI } from '@ai-sdk/openai'

// AI SDK provider — uses the OpenAI Responses API
export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Get a model via the Responses API.
 * Pass `reasoning: true` only for tasks that benefit from chain-of-thought
 * (e.g. extraction, synthesis). Conversational endpoints should leave it off
 * to avoid latency and leaked reasoning tokens.
 */
export function getModel(
  modelId: string,
  options?: { reasoning?: boolean }
) {
  return openaiProvider.responses(modelId, {
    reasoning: options?.reasoning ? { effort: 'medium' } : undefined,
  })
}
