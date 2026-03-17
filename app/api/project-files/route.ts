import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const requestSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  file_url: z.string().min(1),   // storage path, e.g. "{project_id}/{ts}-{filename}"
  description: z.string().max(1000).default(''),
})

/**
 * POST /api/project-files
 * Creates a project_files DB record after the client has uploaded the file
 * to Supabase Storage. The client is responsible for the upload; this route
 * only persists the metadata.
 *
 * Requires: project creator or manage_files permission.
 */
export async function POST(req: Request) {
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

  const { project_id, name, file_url, description } = parsed.data

  // Verify the caller has permission to manage files for this project
  const admin = createAdminClient()
  const [projectResult, accessResult] = await Promise.all([
    admin
      .from('projects')
      .select('id, creator_id')
      .eq('id', project_id)
      .single(),
    admin
      .from('project_access')
      .select('permissions')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const isCreator = projectResult.data?.creator_id === user.id
  const hasPermission =
    accessResult.data?.permissions?.includes('manage_files') ?? false

  if (!isCreator && !hasPermission) {
    return new Response('Forbidden', { status: 403 })
  }

  const { data: projectFile, error } = await admin
    .from('project_files')
    .insert({ project_id, name, file_url, description })
    .select()
    .single()

  if (error) {
    console.error('project_files insert error:', error)
    return Response.json({ error: 'Failed to create file record' }, { status: 500 })
  }

  return Response.json({ project_file: projectFile }, { status: 201 })
}
