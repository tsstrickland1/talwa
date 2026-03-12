import { streamText, tool } from 'ai'
import { z } from 'zod'
import { getModel, MODELS } from '@/lib/openai'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAnalystSystemPrompt } from '@/lib/prompts'
import type { AnalystRequestBody } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: Request) {
  const body = (await req.json()) as AnalystRequestBody
  const { messages, project_id } = body

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify the user is a creator or has project access
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', project_id)
    .single()

  if (!project) {
    return new Response('Project not found', { status: 404 })
  }

  // Load themes for the system prompt
  const { data: themes } = await supabase
    .from('themes')
    .select('*')
    .eq('project_id', project_id)

  const systemPrompt = buildAnalystSystemPrompt({
    project,
    themes: themes ?? [],
  })

  const admin = createAdminClient()

  const result = streamText({
    model: getModel(MODELS.facilitator),
    system: systemPrompt,
    messages,
    tools: {
      surface_theme: tool({
        description:
          'Surface a theme card with its data points. Pass null to return to the themes overview.',
        parameters: z.object({
          theme_id: z.string().nullable(),
        }),
        execute: async ({ theme_id }) => {
          if (!theme_id) {
            const { data: allThemes } = await admin
              .from('themes')
              .select('*')
              .eq('project_id', project_id)
            return { themes: allThemes ?? [], mode: 'overview' }
          }

          const [themeResult, dataPointsResult] = await Promise.all([
            admin.from('themes').select('*').eq('id', theme_id).single(),
            admin
              .from('data_points')
              .select('*')
              .eq('project_id', project_id)
              .contains('theme_ids', [theme_id]),
          ])

          return {
            theme: themeResult.data,
            data_points: dataPointsResult.data ?? [],
            mode: 'theme_detail',
          }
        },
      }),
      query_data_points: tool({
        description:
          'Fetch data points for a specific theme or research question to support deeper analysis.',
        parameters: z.object({
          theme_id: z.string().optional(),
          research_question: z.string().optional(),
          limit: z.number().int().min(1).max(50).default(20),
        }),
        execute: async ({ theme_id, research_question, limit }) => {
          let query = admin
            .from('data_points')
            .select('*')
            .eq('project_id', project_id)
            .limit(limit)

          if (theme_id) {
            query = query.contains('theme_ids', [theme_id])
          }
          if (research_question) {
            query = query.eq('research_question', research_question)
          }

          const { data } = await query
          return { data_points: data ?? [] }
        },
      }),
      get_feature_summary: tool({
        description:
          'Get a summary of community feedback about a specific map feature.',
        parameters: z.object({
          feature_id: z.string(),
        }),
        execute: async ({ feature_id }) => {
          const [featureResult, dataPointsResult] = await Promise.all([
            admin.from('features').select('*').eq('id', feature_id).single(),
            admin
              .from('data_points')
              .select('*')
              .eq('project_id', project_id)
              .eq('feature_id', feature_id),
          ])

          return {
            feature: featureResult.data,
            data_points: dataPointsResult.data ?? [],
            count: dataPointsResult.data?.length ?? 0,
          }
        },
      }),
    },
  })

  return result.toDataStreamResponse()
}
