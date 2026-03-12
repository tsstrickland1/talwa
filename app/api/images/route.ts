import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MODELS } from '@/lib/openai'
import { z } from 'zod'

const requestSchema = z.object({
  prompt: z.string().min(10).max(1000),
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

  const { prompt, feature_id, project_id, perspective_id, caption } = parsed.data

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const response = await openai.images.generate({
      model: MODELS.imageGen,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    })

    if (!response.data || response.data.length === 0) throw new Error('No image data returned')
    const imageData = response.data[0].b64_json
    if (!imageData) throw new Error('No image data returned')

    // Upload to Supabase Storage
    const admin = createAdminClient()
    const fileName = `sketches/${project_id}/${user.id}/${Date.now()}.png`
    const buffer = Buffer.from(imageData, 'base64')

    const { error: uploadError } = await admin.storage
      .from('sketches')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = admin.storage.from('sketches').getPublicUrl(fileName)

    // Create sketch record
    const { data: sketch, error: insertError } = await admin
      .from('sketches')
      .insert({
        project_id,
        feature_id,
        perspective_id: perspective_id ?? null,
        image: urlData.publicUrl,
        caption: caption ?? '',
        creator_id: user.id,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return Response.json({ sketch })
  } catch (error) {
    console.error('Image generation failed:', error)
    return Response.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
