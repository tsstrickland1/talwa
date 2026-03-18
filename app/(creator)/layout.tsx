import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreatorNav } from '@/components/layout/CreatorNav'
import { getManagedProfiles } from '@/lib/supabase/permissions'
import type { User, Project, CreatorProfile } from '@/lib/types'

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

  const admin = createAdminClient()

  let { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
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

  // Fetch all creator profiles this user can manage
  const creatorProfiles = await getManagedProfiles(admin, authUser.id)
  const profileIds = creatorProfiles.map((p) => p.id)

  // Fetch projects for all managed profiles
  let projects: Project[] = []
  if (profileIds.length > 0) {
    const { data } = await admin
      .from('projects')
      .select('*')
      .in('creator_profile_id', profileIds)
      .order('created_at', { ascending: false })
    projects = (data ?? []) as Project[]
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <CreatorNav
        user={profile as User}
        projects={projects}
        creatorProfiles={creatorProfiles}
      />
      <main className="flex-1 overflow-y-auto bg-talwa-cream">{children}</main>
    </div>
  )
}
