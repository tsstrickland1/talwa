import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreatorProfile } from '@/lib/types'

/**
 * Check if a user can manage a project by verifying they are an admin/owner
 * of the project's creator profile (individual or organization).
 *
 * Use this in API routes where RLS is bypassed via admin client.
 */
export async function userCanManageProject(
  admin: SupabaseClient,
  userId: string,
  projectId: string
): Promise<boolean> {
  const { data: project } = await admin
    .from('projects')
    .select('creator_profile_id')
    .eq('id', projectId)
    .single()

  if (!project?.creator_profile_id) return false

  return userCanManageProfile(admin, userId, project.creator_profile_id)
}

/**
 * Check if a user can manage a creator profile.
 * - Individual profiles: user must be the linked user
 * - Organizations: user must be an owner or admin
 */
export async function userCanManageProfile(
  admin: SupabaseClient,
  userId: string,
  profileId: string
): Promise<boolean> {
  const { data: profile } = await admin
    .from('creator_profiles')
    .select('type')
    .eq('id', profileId)
    .single()

  if (!profile) return false

  if (profile.type === 'individual') {
    const { data: link } = await admin
      .from('creator_profile_users')
      .select('user_id')
      .eq('creator_profile_id', profileId)
      .eq('user_id', userId)
      .maybeSingle()

    return !!link
  }

  // Organization: check for owner or admin role
  const { data: member } = await admin
    .from('organization_members')
    .select('role')
    .eq('creator_profile_id', profileId)
    .eq('user_id', userId)
    .maybeSingle()

  return member?.role === 'owner' || member?.role === 'admin'
}

/**
 * Fetch all creator profiles the user can manage (their individual profile + orgs they admin).
 */
export async function getManagedProfiles(
  admin: SupabaseClient,
  userId: string
): Promise<CreatorProfile[]> {
  // Individual profile
  const { data: individualLink } = await admin
    .from('creator_profile_users')
    .select('creator_profile_id')
    .eq('user_id', userId)
    .maybeSingle()

  // Organization memberships with admin+ role
  const { data: orgMemberships } = await admin
    .from('organization_members')
    .select('creator_profile_id')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])

  const profileIds: string[] = []
  if (individualLink) profileIds.push(individualLink.creator_profile_id)
  if (orgMemberships) {
    for (const m of orgMemberships) {
      profileIds.push(m.creator_profile_id)
    }
  }

  if (profileIds.length === 0) return []

  const { data: profiles } = await admin
    .from('creator_profiles')
    .select('*')
    .in('id', profileIds)
    .order('created_at', { ascending: true })

  return (profiles ?? []) as CreatorProfile[]
}

/**
 * Get or create an individual creator profile for a user.
 * Used when a community_contributor creates their first project.
 */
export async function getOrCreateIndividualProfile(
  admin: SupabaseClient,
  userId: string
): Promise<CreatorProfile> {
  // Check for existing individual profile
  const { data: existingLink } = await admin
    .from('creator_profile_users')
    .select('creator_profile_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingLink) {
    const { data: profile } = await admin
      .from('creator_profiles')
      .select('*')
      .eq('id', existingLink.creator_profile_id)
      .single()

    return profile as CreatorProfile
  }

  // Get user info for profile creation
  const { data: user } = await admin
    .from('users')
    .select('name_first, name_last, avatar')
    .eq('id', userId)
    .single()

  if (!user) throw new Error('User not found')

  const name = `${user.name_first} ${user.name_last}`.trim() || 'Unnamed'

  // Generate slug
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!slug) slug = `user-${userId.substring(0, 8)}`

  // Check slug uniqueness and append suffix if needed
  const { data: existing } = await admin
    .from('creator_profiles')
    .select('slug')
    .like('slug', `${slug}%`)

  const existingSlugs = new Set((existing ?? []).map((r: { slug: string }) => r.slug))
  let finalSlug = slug
  let suffix = 1
  while (existingSlugs.has(finalSlug)) {
    finalSlug = `${slug}-${suffix}`
    suffix++
  }

  // Create profile
  const { data: profile } = await admin
    .from('creator_profiles')
    .insert({
      type: 'individual',
      name,
      slug: finalSlug,
      avatar: user.avatar,
      description: '',
    })
    .select('*')
    .single()

  if (!profile) throw new Error('Failed to create creator profile')

  // Link to user
  await admin
    .from('creator_profile_users')
    .insert({ creator_profile_id: profile.id, user_id: userId })

  // Promote user to project_creator if they're a community_contributor
  await admin
    .from('users')
    .update({ user_type: 'project_creator' })
    .eq('id', userId)
    .eq('user_type', 'community_contributor')

  return profile as CreatorProfile
}
