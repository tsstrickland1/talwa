import { streamText, tool } from 'ai'
import type { CoreMessage } from 'ai'
import { z } from 'zod'
import { getModel, MODELS } from '@/lib/openai'
import { queryVectorStore } from '@/lib/openai/vectorStore'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildFacilitatorSystemPrompt } from '@/lib/prompts'
import { getSignedFileUrl } from '@/lib/supabase/storage'
import type { FacilitatorRequestBody, Feature, ProjectFile } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: Request) {
  const body = (await req.json()) as FacilitatorRequestBody
  const { messages, location, feature_id, contributor_drew, project_id, conversation_id, vector_store_id, insights_mode } = body

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Load all context in parallel
  const admin = createAdminClient()
  const [projectResult, featuresResult, frameworkResult, themesResult, filesResult] =
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
      admin
        .from('project_files')
        .select('id, name, file_url, description')
        .eq('project_id', project_id),
    ])

  if (projectResult.error || !projectResult.data) {
    return new Response('Project not found', { status: 404 })
  }

  const features: Feature[] = featuresResult.data ?? []
  const activeFeature = feature_id
    ? features.find((f) => f.id === feature_id) ?? null
    : null

  // Generate signed URLs for project files so the facilitator can reference them
  const rawFiles: ProjectFile[] = (filesResult.data as ProjectFile[]) ?? []
  const projectFiles = await Promise.all(
    rawFiles.map(async (f) => {
      try {
        const signedUrl = await getSignedFileUrl(admin, f.file_url)
        return { ...f, signed_url: signedUrl }
      } catch {
        return null
      }
    })
  ).then((results) => results.filter(Boolean) as (ProjectFile & { signed_url: string })[])

  // Query attached documents if the conversation has a vector store
  let attachedDocumentChunks: string[] | undefined
  if (vector_store_id) {
    const lastUserMessage = messages[messages.length - 1]
    const queryText =
      typeof lastUserMessage?.content === 'string'
        ? lastUserMessage.content
        : (lastUserMessage?.content ?? [])
            .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
            .map((b) => b.text)
            .join(' ')

    if (queryText.trim()) {
      attachedDocumentChunks = await queryVectorStore(vector_store_id, queryText, 5)
    }
  }

  const systemPrompt = buildFacilitatorSystemPrompt({
    project: projectResult.data,
    features,
    analyticalFramework: frameworkResult.data ?? null,
    existingThemes: themesResult.data ?? [],
    projectFiles,
    location: location ?? null,
    activeFeature,
    contributorDrew: contributor_drew ?? false,
    attachedDocumentChunks,
    insightsMode: insights_mode ?? false,
  })

  // Persist the user's message before streaming
  const lastUserMessage = messages[messages.length - 1]
  if (lastUserMessage?.role === 'user') {
    // content may be a string or an array of content blocks (e.g. when an image is attached)
    const contentText =
      typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : lastUserMessage.content
            .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
            .map((b) => b.text)
            .join(' ')

    await Promise.all([
      admin.from('messages').insert({
        conversation_id,
        sender: 'human',
        content: contentText,
        referenced_feature_ids: feature_id ? [feature_id] : [],
        location: location ?? null,
        creator_id: user.id,
      }),
      admin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation_id),
    ])
  }

  const result = streamText({
    model: getModel(MODELS.facilitator),
    system: systemPrompt,
    messages: messages as CoreMessage[],
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
