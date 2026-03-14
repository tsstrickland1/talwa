import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { User, ProjectAccess } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ContributorsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()

  const [projectResult, accessResult] = await Promise.all([
    admin.from('projects').select('name').eq('id', id).single(),
    admin
      .from('project_access')
      .select('*, users(*)')
      .eq('project_id', id),
  ])

  if (!projectResult.data) notFound()

  const accessList = (accessResult.data ?? []) as Array<ProjectAccess & { users: User }>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-heading text-2xl font-bold text-talwa-navy mb-2">
        Contributors
      </h1>
      <p className="text-talwa-navy/60 mb-6">
        Manage access to {projectResult.data.name}.
      </p>

      {accessList.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">👥</div>
          <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-2">
            No contributors yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Contributors who have engaged with this project will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {accessList.map((access) => {
            const user = access.users
            const initials = `${user?.name_first?.[0] ?? ''}${user?.name_last?.[0] ?? ''}`.toUpperCase()
            return (
              <div
                key={access.id}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-white"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-talwa-navy text-sm">
                    {user?.name_first} {user?.name_last}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {access.permissions.slice(0, 3).map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
