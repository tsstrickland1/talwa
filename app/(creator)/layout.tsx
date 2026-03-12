import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    redirect('/login')
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
