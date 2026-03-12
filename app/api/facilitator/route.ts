import { streamText, tool } from 'ai'
import { z } from 'zod'
import { getModel, MODELS } from '@/lib/openai'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildFacilitatorSystemPrompt } from '@/lib/prompts'
import type { FacilitatorRequestBody, Feature } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: Request) {
  const body = (await req.json()) as FacilitatorRequestBody
  const { messages, location, feature_id, project_id, conversation_id } = body

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Load all context in parallel
  const [projectResult, featuresResult, frameworkResult, themesResult] =
    await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .single(),
      supabase
        .from('features')
        .select('*')
        .eq('project_id', project_id),
      supabase
        .from('analytical_frameworks')
        .select('*')
        .eq('project_id', project_id)
        .maybeSingle(),
      supabase
        .from('themes')
        .select('*')
        .eq('project_id', project_id),
    ])

  if (projectResult.error || !projectResult.data) {
    return new Response('Project not found', { status: 404 })
  }

  const features: Feature[] = featuresResult.data ?? []
  const activeFeature = feature_id
    ? features.find((f) => f.id === feature_id) ?? null
    : null

  const systemPrompt = buildFacilitatorSystemPrompt({
    project: projectResult.data,
    features,
    analyticalFramework: frameworkResult.data ?? null,
    existingThemes: themesResult.data ?? [],
    location: location ?? null,
    activeFeature,
  })

  const result = streamText({
    model: getModel(MODELS.facilitator),
    system: systemPrompt,
    messages,
    tools: {
      reset_location: tool({
        description:
          'Clear the active location pin from the map. Call this when the conversation moves to a new topic unrelated to the current pinned location.',
        parameters: z.object({}),
        execute: async () => ({ success: true }),
      }),
      surface_theme: tool({
        description:
          'Surface a theme card in the conversation UI. Pass null to return to the themes overview.',
        parameters: z.object({
          theme_id: z
            .string()
            .nullable()
            .describe('The ID of the theme to surface, or null to reset to overview'),
        }),
        execute: async ({ theme_id }) => {
          if (!theme_id) return { theme: null, data_points: [] }

          const admin = createAdminClient()
          const [themeResult, dataPointsResult] = await Promise.all([
            admin.from('themes').select('*').eq('id', theme_id).single(),
            admin
              .from('data_points')
              .select('*')
              .eq('project_id', project_id)
              .contains('theme_ids', [theme_id])
              .limit(10),
          ])

          return {
            theme: themeResult.data,
            data_points: dataPointsResult.data ?? [],
          }
        },
      }),
      surface_data_point: tool({
        description:
          'Surface a specific data point card in the conversation UI, typically when a map marker is clicked.',
        parameters: z.object({
          data_point_id: z
            .string()
            .describe('The ID of the data point to surface'),
        }),
        execute: async ({ data_point_id }) => {
          const admin = createAdminClient()
          const { data } = await admin
            .from('data_points')
            .select('*')
            .eq('id', data_point_id)
            .single()

          return { data_point: data }
        },
      }),
    },
    onFinish: async ({ text }) => {
      // Persist the AI response as a message
      const admin = createAdminClient()
      await admin.from('messages').insert({
        conversation_id,
        sender: 'ai_facilitator',
        content: text,
        referenced_feature_ids: feature_id ? [feature_id] : [],
        location: null,
        creator_id: user.id,
      })
    },
  })

  return result.toDataStreamResponse()
}
