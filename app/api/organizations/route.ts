import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/organizations
 * Creates a new organization profile and sets the authenticated user as owner.
 * Uses the admin client to bypass RLS for the organization_members insert —
 * a bootstrap is needed because the owner policy requires you to already be a member.
 */
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json() as { name: string; description?: string }
  const { name, description } = body

  if (!name?.trim()) {
    return new Response('Name is required', { status: 400 })
  }

  const admin = createAdminClient()

  // Generate slug from name
  let slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!slug) slug = `org-${Date.now()}`

  // Create the creator profile, retrying once on slug conflict
  let profileId: string | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: profile, error: profileError } = await admin
      .from('creator_profiles')
      .insert({
        type: 'organization',
        name: name.trim(),
        slug,
        description: description?.trim() ?? '',
      })
      .select('id')
      .single()

    if (profileError) {
      if (profileError.code === '23505' && attempt === 0) {
        slug = `${slug}-${Date.now().toString(36)}`
        continue
      }
      return new Response(profileError.message, { status: 500 })
    }

    profileId = profile.id
    break
  }

  if (!profileId) {
    return new Response('Failed to create organization', { status: 500 })
  }

  // Add user as owner — uses admin client to bypass RLS bootstrap problem
  const { error: memberError } = await admin.from('organization_members').insert({
    creator_profile_id: profileId,
    user_id: user.id,
    role: 'owner',
  })

  if (memberError) {
    // Roll back the profile to avoid an orphaned org
    await admin.from('creator_profiles').delete().eq('id', profileId)
    return new Response(memberError.message, { status: 500 })
  }

  return Response.json({ id: profileId })
}
