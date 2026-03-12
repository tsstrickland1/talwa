import type { DataPoint, Theme } from '@/lib/types'

export function buildClassifySystemPrompt(): string {
  return `You are a classification assistant for qualitative community research data. Your job is to assign data points to the most relevant existing themes.

Return ONLY valid JSON. No explanation, no markdown code blocks.`
}

export function buildClassifyUserPrompt({
  dataPoints,
  themes,
}: {
  dataPoints: DataPoint[]
  themes: Theme[]
}): string {
  const themesText = themes
    .map(t => `[${t.id}] "${t.name}": ${t.summary}`)
    .join('\n')

  const dataPointsText = dataPoints
    .map((dp, i) => `${i + 1}. [${dp.id}] ${dp.content}`)
    .join('\n')

  return `Classify each data point into the most relevant themes.

AVAILABLE THEMES:
${themesText}

DATA POINTS TO CLASSIFY:
${dataPointsText}

Return a JSON object with this exact structure:
{
  "classifications": [
    {
      "data_point_id": "UUID of the data point",
      "theme_ids": ["UUID of primary theme", "UUID of secondary theme (if applicable)"]
    }
  ]
}

Rules:
- Assign 1-3 theme IDs per data point, ordered by relevance (most relevant first)
- Only use theme IDs from the list above
- Every data point must have at least one classification
- If no theme is a good fit, assign to the closest available theme`
}
