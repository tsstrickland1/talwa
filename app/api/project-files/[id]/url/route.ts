import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedFileUrl } from '@/lib/supabase/storage'

/**
 * GET /api/project-files/[id]/url
 * Returns a short-lived signed URL for a private project file.
 * The client should call this before rendering a download link or
 * embedding file content — never store the signed URL long-term.
 *
 * Requires: any project member (contributor or creator).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch the file record
  const { data: file, error: fileError } = await admin
    .from('project_files')
    .select('id, project_id, name, file_url')
    .eq('id', id)
    .single()

  if (fileError || !file) {
    return new Response('Not found', { status: 404 })
  }

  // Verify caller is a project member
  const [projectResult, accessResult] = await Promise.all([
    admin
      .from('projects')
      .select('creator_id')
      .eq('id', file.project_id)
      .single(),
    admin
      .from('project_access')
      .select('id')
      .eq('project_id', file.project_id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const isCreator = projectResult.data?.creator_id === user.id
  const isMember = !!accessResult.data

  if (!isCreator && !isMember) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const signedUrl = await getSignedFileUrl(admin, file.file_url)
    return Response.json({ url: signedUrl, expires_in: 3600 })
  } catch (err) {
    console.error('Failed to generate signed URL:', err)
    return Response.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }
}
