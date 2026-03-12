import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel, MODELS } from '@/lib/openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildClassifySystemPrompt, buildClassifyUserPrompt } from '@/lib/prompts'
import type { ClassifyRequestBody } from '@/lib/types'

export const maxDuration = 30

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const extractionSecret = process.env.EXTRACTION_SECRET

  if (!extractionSecret || authHeader !== `Bearer ${extractionSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = (await req.json()) as ClassifyRequestBody
  const { project_id, data_point_ids } = body

  const admin = createAdminClient()

  const [dataPointsResult, themesResult] = await Promise.all([
    admin.from('data_points').select('*').in('id', data_point_ids),
    admin.from('themes').select('*').eq('project_id', project_id),
  ])

  if (
    !dataPointsResult.data ||
    !themesResult.data ||
    themesResult.data.length === 0
  ) {
    return Response.json({ classified: 0 })
  }

  try {
    const { object } = await generateObject({
      model: getModel(MODELS.classify),
      system: buildClassifySystemPrompt(),
      prompt: buildClassifyUserPrompt({
        dataPoints: dataPointsResult.data,
        themes: themesResult.data,
      }),
      schema: z.object({
        classifications: z.array(
          z.object({
            data_point_id: z.string(),
            theme_ids: z.array(z.string()),
          })
        ),
      }),
    })

    await Promise.all(
      object.classifications.map((c) =>
        admin
          .from('data_points')
          .update({ theme_ids: c.theme_ids })
          .eq('id', c.data_point_id)
      )
    )

    return Response.json({ classified: object.classifications.length })
  } catch (error) {
    console.error('Classification failed:', error)
    return Response.json({ error: 'Classification failed' }, { status: 500 })
  }
}
