import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { userCanManageProfile } from '@/lib/supabase/permissions'

type Params = {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/creator-profiles/[id]
 * Updates name and/or description of a creator profile.
 * Requires the authenticated user to be an owner/admin of the profile.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  const canManage = await userCanManageProfile(admin, user.id, id)
  if (!canManage) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await request.json() as { name?: string; description?: string; avatar?: string }
  const updates: { name?: string; description?: string; avatar?: string } = {}
  if (typeof body.name === 'string') updates.name = body.name.trim()
  if (typeof body.description === 'string') updates.description = body.description.trim()
  if (typeof body.avatar === 'string') updates.avatar = body.avatar

  if (Object.keys(updates).length === 0) {
    return new Response('No valid fields to update', { status: 400 })
  }

  const { data, error } = await admin
    .from('creator_profiles')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  // For individual profiles, keep users.avatar in sync so the nav menu reflects the change
  if (updates.avatar && data.type === 'individual') {
    const { data: link } = await admin
      .from('creator_profile_users')
      .select('user_id')
      .eq('creator_profile_id', id)
      .single()
    if (link) {
      await admin.from('users').update({ avatar: updates.avatar }).eq('id', link.user_id)
    }
  }

  return Response.json(data)
}
