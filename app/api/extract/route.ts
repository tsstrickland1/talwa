import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel, MODELS } from '@/lib/openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildExtractSystemPrompt, buildExtractUserPrompt } from '@/lib/prompts'
import type { ExtractRequestBody } from '@/lib/types'

export const maxDuration = 60

// Called by the Supabase Edge Function trigger-extraction, not by the client
export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const extractionSecret = process.env.EXTRACTION_SECRET

  if (!extractionSecret || authHeader !== `Bearer ${extractionSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = (await req.json()) as ExtractRequestBody
  const { conversation_id, project_id } = body

  const admin = createAdminClient()

  // Load everything needed for extraction
  const [messagesResult, frameworkResult, featuresResult] = await Promise.all([
    admin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true }),
    admin
      .from('analytical_frameworks')
      .select('*')
      .eq('project_id', project_id)
      .maybeSingle(),
    admin.from('features').select('*').eq('project_id', project_id),
  ])

  if (!messagesResult.data || messagesResult.data.length === 0) {
    await admin
      .from('conversations')
      .update({ extraction_status: 'complete' })
      .eq('id', conversation_id)
    return Response.json({ extracted: 0 })
  }

  // Build transcript string
  const transcript = messagesResult.data
    .map((m) => {
      const role = m.sender === 'human' ? 'Community Member' : 'Facilitator'
      const locationNote =
        m.location
          ? ` [Pin at lat ${(m.location as { lat: number; lng: number }).lat}, lng ${(m.location as { lat: number; lng: number }).lng}]`
          : ''
      return `${role}${locationNote}: ${m.content}`
    })
    .join('\n\n')

  if (!frameworkResult.data) {
    // No framework — mark complete without extracting
    await admin
      .from('conversations')
      .update({ extraction_status: 'complete' })
      .eq('id', conversation_id)
    return Response.json({ extracted: 0, reason: 'no_framework' })
  }

  try {
    const { object } = await generateObject({
      model: getModel(MODELS.extract),
      system: buildExtractSystemPrompt(),
      prompt: buildExtractUserPrompt({
        transcript,
        analyticalFramework: frameworkResult.data,
        features: featuresResult.data ?? [],
      }),
      schema: z.object({
        data_points: z.array(
          z.object({
            content: z.string(),
            research_question: z.string(),
            feature_id: z.string().nullable(),
            location: z
              .object({ lat: z.number(), lng: z.number() })
              .nullable(),
          })
        ),
      }),
    })

    if (object.data_points.length === 0) {
      await admin
        .from('conversations')
        .update({ extraction_status: 'complete' })
        .eq('id', conversation_id)
      return Response.json({ extracted: 0 })
    }

    // Get the conversation creator for creator_id field
    const { data: conversation } = await admin
      .from('conversations')
      .select('creator_id')
      .eq('id', conversation_id)
      .single()

    // Insert all data points
    const { data: insertedPoints, error: insertError } = await admin
      .from('data_points')
      .insert(
        object.data_points.map((dp) => ({
          project_id,
          conversation_id,
          content: dp.content,
          research_question: dp.research_question,
          feature_id: dp.feature_id,
          location: dp.location,
          theme_ids: [],
          creator_id: conversation?.creator_id,
        }))
      )
      .select('id, research_question')

    if (insertError) throw insertError

    // Group by research question and trigger synthesis for each bucket
    const byResearchQuestion = new Map<string, string[]>()
    for (const dp of insertedPoints ?? []) {
      const ids = byResearchQuestion.get(dp.research_question) ?? []
      ids.push(dp.id)
      byResearchQuestion.set(dp.research_question, ids)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
      await Promise.allSettled(
        Array.from(byResearchQuestion.entries()).map(([rq, ids]) =>
          fetch(`${appUrl}/api/synthesize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${extractionSecret}`,
            },
            body: JSON.stringify({
              project_id,
              new_data_point_ids: ids,
              research_question: rq,
            }),
          })
        )
      )
    }

    await admin
      .from('conversations')
      .update({ extraction_status: 'complete' })
      .eq('id', conversation_id)

    return Response.json({ extracted: object.data_points.length })
  } catch (error) {
    console.error('Extraction failed:', error)
    await admin
      .from('conversations')
      .update({ extraction_status: 'failed' })
      .eq('id', conversation_id)
    return Response.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
