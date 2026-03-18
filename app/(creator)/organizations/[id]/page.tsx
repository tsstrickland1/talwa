import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { userCanManageProfile } from '@/lib/supabase/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProjectCard } from '@/components/cards/ProjectCard'
import { Users, Settings, Plus } from 'lucide-react'
import type { Project, CreatorProfile, OrganizationMember } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function OrganizationPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const admin = createAdminClient()

  // Fetch the organization profile
  const { data: profile } = await admin
    .from('creator_profiles')
    .select('*')
    .eq('id', id)
    .eq('type', 'organization')
    .single()

  if (!profile) notFound()

  const canManage = await userCanManageProfile(admin, authUser.id, id)

  // Fetch members
  const { data: members } = await admin
    .from('organization_members')
    .select('*, user:users(id, name_first, name_last, email, avatar)')
    .eq('creator_profile_id', id)
    .order('created_at', { ascending: true })

  // Fetch projects
  const { data: projects } = await admin
    .from('projects')
    .select('*')
    .eq('creator_profile_id', id)
    .order('created_at', { ascending: false })

  const typedProfile = profile as CreatorProfile
  const typedProjects = (projects ?? []) as Project[]
  const memberCount = members?.length ?? 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-talwa-navy">
            {typedProfile.name}
          </h1>
          {typedProfile.description && (
            <p className="text-talwa-navy/60 mt-1 max-w-xl">
              {typedProfile.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3">
            <Badge variant="secondary">Organization</Badge>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/organizations/${id}/members`}>
                <Users className="h-4 w-4 mr-1.5" />
                Members
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Projects */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-talwa-navy">
          Projects
        </h2>
        {canManage && (
          <Button size="sm" asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4 mr-1.5" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      {typedProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No projects yet. Create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {typedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
