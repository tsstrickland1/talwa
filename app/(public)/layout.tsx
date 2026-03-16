import { createClient } from '@/lib/supabase/server'
import { PublicNav } from '@/components/layout/PublicNav'
import type { User } from '@/lib/types'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  let user: User | null = null
  if (authUser) {
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()
    user = (profile as User) ?? null
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PublicNav user={user} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
