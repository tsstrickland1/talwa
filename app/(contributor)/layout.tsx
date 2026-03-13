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
    // The regular client (subject to RLS) may return null even if the row exists.
    // Re-check with the admin client (bypasses RLS) before creating a new row,
    // to avoid overwriting an existing user_type via upsert conflict resolution.
    const admin = createAdminClient()
    const { data: existingProfile } = await admin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (existingProfile) {
      profile = existingProfile
    } else {
      // Row truly doesn't exist (e.g. DB trigger didn't fire). Create a minimal one.
      const { data: created } = await admin
        .from('users')
        .insert({
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
  }

  return (
    <div className="flex flex-col min-h-screen">
      <ContributorNav user={profile as User} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
