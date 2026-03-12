import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContributorNav } from '@/components/layout/ContributorNav'
import type { User } from '@/lib/types'

export default async function ContributorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login?next=/explore')
  }

  let { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    // Profile row is missing (e.g. DB trigger didn't fire). Create a minimal one so
    // the user isn't stuck in a redirect loop. They can fill in their name later.
    const admin = createAdminClient()
    const { data: created } = await admin
      .from('users')
      .upsert({
        id: authUser.id,
        email: authUser.email ?? '',
        name_first: '',
        name_last: '',
        user_type: 'community_contributor',
      })
      .select()
      .single()

    if (!created) {
      redirect('/auth/signout')
    }
    profile = created
  }

  return (
    <div className="flex flex-col min-h-screen">
      <ContributorNav user={profile as User} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
