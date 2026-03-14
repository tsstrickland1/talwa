import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreatorNav } from '@/components/layout/CreatorNav'
import type { User, Project } from '@/lib/types'

export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login?next=/dashboard')
  }

  let { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    // Regular client (subject to RLS) may return null if the session cookie isn't
    // forwarding correctly. Re-check with admin client to get the real profile.
    const admin = createAdminClient()
    const { data: adminProfile } = await admin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (!adminProfile) {
      redirect('/login')
    }
    profile = adminProfile
  }

  if (profile.user_type === 'community_contributor') {
    redirect('/explore')
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('creator_id', authUser.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex h-screen overflow-hidden">
      <CreatorNav
        user={profile as User}
        projects={(projects ?? []) as Project[]}
      />
      <main className="flex-1 overflow-y-auto bg-talwa-cream">{children}</main>
    </div>
  )
}
