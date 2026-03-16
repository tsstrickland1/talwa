import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function ContributorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // If the user is authenticated, ensure a profile record exists
  if (authUser) {
    let { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (!profile) {
      const admin = createAdminClient()
      const { data: existingProfile } = await admin
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (existingProfile) {
        profile = existingProfile
      } else {
        await admin.from('users').insert({
          id: authUser.id,
          email: authUser.email ?? '',
          name_first: '',
          name_last: '',
          user_type: 'community_contributor',
        })
      }
    }
  }

  // No redirect for unauthenticated users — project pages handle auth gating
  return <>{children}</>
}
