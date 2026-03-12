import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel, MODELS } from '@/lib/openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSynthesizeSystemPrompt, buildSynthesizeUserPrompt } from '@/lib/prompts'
import type { SynthesizeRequestBody } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const extractionSecret = process.env.EXTRACTION_SECRET

  if (!extractionSecret || authHeader !== `Bearer ${extractionSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = (await req.json()) as SynthesizeRequestBody
  const { project_id, new_data_point_ids, research_question } = body

  const admin = createAdminClient()

  // Load new data points and existing themes for this research question
  const [newDataPointsResult, existingThemesResult] = await Promise.all([
    admin
      .from('data_points')
      .select('*')
      .in('id', new_data_point_ids),
    admin
      .from('themes')
      .select('*')
      .eq('project_id', project_id)
      .eq('research_question', research_question),
  ])

  if (!newDataPointsResult.data || newDataPointsResult.data.length === 0) {
    return Response.json({ synthesized: 0 })
  }

  try {
    const { object } = await generateObject({
      model: getModel(MODELS.synthesize),
      system: buildSynthesizeSystemPrompt(),
      prompt: buildSynthesizeUserPrompt({
        newDataPoints: newDataPointsResult.data,
        existingThemes: existingThemesResult.data ?? [],
        researchQuestion: research_question,
      }),
      schema: z.object({
        assignments: z.array(
          z.object({
            data_point_id: z.string(),
            theme_id: z.string(),
          })
        ),
        new_themes: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            summary: z.string(),
            rationale: z.string(),
          })
        ),
        theme_updates: z.array(
          z.object({
            theme_id: z.string(),
            updated_summary: z.string(),
          })
        ),
      }),
    })

    // Get project creator for creator_id
    const { data: project } = await admin
      .from('projects')
      .select('creator_id')
      .eq('id', project_id)
      .single()

    // Insert new themes
    if (object.new_themes.length > 0) {
      await admin.from('themes').insert(
        object.new_themes.map((t) => ({
          id: t.id,
          project_id,
          name: t.name,
          summary: t.summary,
          research_question,
          creator_id: project?.creator_id,
        }))
      )
    }

    // Update existing themes
    await Promise.all(
      object.theme_updates.map((update) =>
        admin
          .from('themes')
          .update({ summary: update.updated_summary, updated_at: new Date().toISOString() })
          .eq('id', update.theme_id)
      )
    )

    // Update data points with their theme assignments
    const themeAssignmentMap = new Map<string, string[]>()
    for (const assignment of object.assignments) {
      const existing = themeAssignmentMap.get(assignment.data_point_id) ?? []
      existing.push(assignment.theme_id)
      themeAssignmentMap.set(assignment.data_point_id, existing)
    }

    await Promise.all(
      Array.from(themeAssignmentMap.entries()).map(([dpId, themeIds]) =>
        admin
          .from('data_points')
          .update({ theme_ids: themeIds })
          .eq('id', dpId)
      )
    )

    return Response.json({
      new_themes: object.new_themes.length,
      updated_themes: object.theme_updates.length,
      assigned_data_points: object.assignments.length,
    })
  } catch (error) {
    console.error('Synthesis failed:', error)
    return Response.json({ error: 'Synthesis failed' }, { status: 500 })
  }
}
