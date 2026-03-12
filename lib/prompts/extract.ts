import type { AnalyticalFramework, Feature } from '@/lib/types'

export function buildExtractSystemPrompt(): string {
  return `You are a data extraction specialist for community engagement research. Your job is to identify and extract discrete data points from community conversation transcripts.

A data point is a single, specific insight, concern, idea, observation, or opinion expressed by a community member. Each data point should be:
- Self-contained and understandable without the full transcript
- Attributed to a specific research question
- Tied to a location if one was mentioned or implied
- Expressed in the contributor's own words (lightly paraphrased if needed for clarity)

Return ONLY valid JSON matching the schema provided. No explanation, no markdown code blocks.`
}

export function buildExtractUserPrompt({
  transcript,
  analyticalFramework,
  features,
}: {
  transcript: string
  analyticalFramework: AnalyticalFramework
  features: Feature[]
}): string {
  const featureList = features.length > 0
    ? features.map(f => `[${f.id}] ${f.name} (${f.type}): ${f.description}`).join('\n')
    : 'No named features.'

  const researchQuestions = analyticalFramework.research_questions.length > 0
    ? analyticalFramework.research_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : '1. General community feedback'

  return `Extract structured data points from this community engagement conversation.

RESEARCH QUESTIONS:
${researchQuestions}

MAP FEATURES (reference by ID if the contributor mentions them):
${featureList}

CONVERSATION TRANSCRIPT:
${transcript}

For each distinct insight, concern, idea, or observation expressed by the community member (not the facilitator), extract a data point.

Return a JSON object with this exact structure:
{
  "data_points": [
    {
      "content": "The specific insight expressed (1-3 sentences, contributor's voice)",
      "research_question": "The exact research question this addresses (copy it verbatim from the list above)",
      "feature_id": "UUID from the feature list if the comment is about a specific feature, otherwise null",
      "location": { "lat": number, "lng": number } or null
    }
  ]
}

Rules:
- Only extract content from the community member's messages, not the facilitator's
- Each data point must address exactly one research question — choose the most relevant
- Use location coordinates if they appear in the transcript metadata (e.g., "Pin at lat X, lng Y")
- If the same insight is expressed multiple ways, create one data point
- Minimum content: at least 10 words; maximum: 150 words per data point
- If nothing relevant was said, return { "data_points": [] }`
}
