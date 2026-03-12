import type { DataPoint, Theme } from '@/lib/types'

export function buildSynthesizeSystemPrompt(): string {
  return `You are a qualitative research analyst specializing in community engagement data. Your job is to synthesize community feedback data points into meaningful themes.

CRITICAL GUIDELINES:
- Prefer refinement and evolution of existing themes over creating new ones
- Only create a new theme if no existing theme reasonably fits
- Never merge themes unless they are truly redundant (same core idea with different wording)
- Theme names should be short (3-7 words), memorable, and action-oriented or issue-oriented
- Theme summaries should be 1-3 sentences capturing the essence of what community members are saying
- Preserve nuance — don't flatten distinct concerns into a single theme
- When updating a summary, incorporate the new perspective without losing the original meaning

Return ONLY valid JSON matching the schema provided. No explanation, no markdown code blocks.`
}

export function buildSynthesizeUserPrompt({
  newDataPoints,
  existingThemes,
  researchQuestion,
}: {
  newDataPoints: DataPoint[]
  existingThemes: Theme[]
  researchQuestion: string
}): string {
  const existingThemesText = existingThemes.length > 0
    ? existingThemes.map(t => `[${t.id}] "${t.name}"\nSummary: ${t.summary}`).join('\n\n')
    : 'No existing themes — you are establishing the first themes for this research question.'

  const dataPointsText = newDataPoints
    .map((dp, i) => `${i + 1}. [${dp.id}] ${dp.content}`)
    .join('\n')

  return `Synthesize these new community feedback data points into themes for the following research question.

RESEARCH QUESTION: "${researchQuestion}"

EXISTING THEMES:
${existingThemesText}

NEW DATA POINTS TO PROCESS:
${dataPointsText}

For each new data point, decide:
a) Assign it to an EXISTING theme if there is a reasonable fit
b) Create a NEW theme if no existing theme fits well

Return a JSON object with this exact structure:
{
  "assignments": [
    {
      "data_point_id": "UUID of the data point",
      "theme_id": "UUID of the existing or new theme this data point belongs to"
    }
  ],
  "new_themes": [
    {
      "id": "generate a new UUID v4 here",
      "name": "Short, memorable theme name (3-7 words)",
      "summary": "1-3 sentences describing what community members are expressing through this theme",
      "rationale": "Why this deserved a new theme rather than fitting an existing one"
    }
  ],
  "theme_updates": [
    {
      "theme_id": "UUID of existing theme to update",
      "updated_summary": "Revised summary incorporating the new data point perspective"
    }
  ]
}

Every data point ID in the input must appear in exactly one assignment.
New theme IDs in assignments must match IDs in new_themes.
theme_updates should only appear when a new data point genuinely expands the theme's meaning.`
}
