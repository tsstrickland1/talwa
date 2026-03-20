export const MODELS = {
  facilitator: 'gpt-5',
  extract: 'gpt-5-nano',
  synthesize: 'gpt-5-mini',
  classify: 'gpt-5-nano',
  imageGen: 'gpt-image-1',
} as const

export type ModelKey = keyof typeof MODELS
