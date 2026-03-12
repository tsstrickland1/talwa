// Central model constants — update here when actual OpenAI model IDs are confirmed
export const MODELS = {
  facilitator: 'gpt-4o',       // Replace with 'gpt-5' when available
  extract: 'gpt-4o-mini',      // Replace with 'gpt-5-nano' when available
  synthesize: 'gpt-4o-mini',   // Replace with 'gpt-5-mini' when available
  classify: 'gpt-4o-mini',     // Replace with 'gpt-5-nano' when available
  imageGen: 'dall-e-3',        // Replace with 'gpt-image-1' when available
} as const

export type ModelKey = keyof typeof MODELS
