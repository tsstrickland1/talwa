import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MODELS } from '@/lib/openai'
import { z } from 'zod'
import { toFile } from 'openai'

const requestSchema = z.object({
  prompt: z.string().min(10).max(1000),
  feature_id: z.string().uuid(),
  project_id: z.string().uuid(),
  reference_image_url: z.string().url().optional(),
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

  const { prompt, feature_id, project_id, reference_image_url } = parsed.data

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    let imageData: string

    if (reference_image_url) {
      // Fetch the reference image and use edit mode
      const refResponse = await fetch(reference_image_url)
      if (!refResponse.ok) throw new Error('Failed to fetch reference image')
      const refBuffer = Buffer.from(await refResponse.arrayBuffer())
      const refFile = await toFile(refBuffer, 'reference.png', { type: 'image/png' })

      // dall-e-3 doesn't support images.edit(); use dall-e-2 for reference-guided generation.
      // When MODELS.imageGen is updated to gpt-image-1 this branch can use that model instead.
      const editResponse = await openai.images.edit({
        model: 'dall-e-2',
        image: refFile,
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      })

      if (!editResponse.data?.[0]?.b64_json) throw new Error('No image data returned')
      imageData = editResponse.data[0].b64_json
    } else {
      const genResponse = await openai.images.generate({
        model: MODELS.imageGen,
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      })

      if (!genResponse.data?.[0]?.b64_json) throw new Error('No image data returned')
      imageData = genResponse.data[0].b64_json
    }

    // Upload to Supabase Storage — not yet committed to DB
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

    // Return the URL only — caller decides whether to publish to DB
    return Response.json({ image_url: urlData.publicUrl, feature_id, project_id })
  } catch (error) {
    console.error('Image generation failed:', error)
    return Response.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
