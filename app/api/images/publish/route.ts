import { NextRequest } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const requestSchema = z.object({
  image_url: z.string().url(),
  feature_id: z.string().uuid(),
  project_id: z.string().uuid(),
  perspective_id: z.string().uuid().optional(),
  caption: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { image_url, feature_id, project_id, perspective_id, caption } = parsed.data

  const admin = createAdminClient()

  const { data: sketch, error } = await admin
    .from('sketches')
    .insert({
      project_id,
      feature_id,
      perspective_id: perspective_id ?? null,
      image: image_url,
      caption: caption ?? '',
      creator_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Sketch publish failed:', error)
    return Response.json({ error: 'Failed to publish sketch' }, { status: 500 })
  }

  return Response.json({ sketch })
}
