import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col min-h-screen">
      <ContributorNav user={profile as User} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
