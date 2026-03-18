import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getManagedProfiles, getOrCreateIndividualProfile } from '@/lib/supabase/permissions'

/**
 * GET /api/creator-profiles
 * Returns all creator profiles the current user can manage.
 * Auto-creates an individual profile if the user doesn't have one yet.
 */
export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // Ensure user has at least an individual profile
  await getOrCreateIndividualProfile(admin, user.id)

  const profiles = await getManagedProfiles(admin, user.id)

  return Response.json({ profiles })
}
