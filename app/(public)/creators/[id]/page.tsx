import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProjectCard } from '@/components/cards/ProjectCard'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import type { Project, CreatorProfile } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function CreatorProfilePage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  // Try to find by slug first, then by ID
  let { data: profile } = await admin
    .from('creator_profiles')
    .select('*')
    .eq('slug', id)
    .single()

  if (!profile) {
    const { data: byId } = await admin
      .from('creator_profiles')
      .select('*')
      .eq('id', id)
      .single()
    profile = byId
  }

  if (!profile) notFound()

  const typedProfile = profile as CreatorProfile

  const { data: projects } = await admin
    .from('projects')
    .select('*')
    .eq('creator_profile_id', typedProfile.id)
    .eq('publicly_visible', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // For organizations, get member count
  let memberCount = 0
  if (typedProfile.type === 'organization') {
    const { count } = await admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('creator_profile_id', typedProfile.id)
    memberCount = count ?? 0
  }

  const initials = typedProfile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#FAFAEF' }}>
      {/* Hero */}
      <section className="w-full py-14 px-4 border-b border-border" style={{ backgroundColor: '#FAFAEF' }}>
        <div className="mx-auto max-w-2xl flex flex-col items-center text-center gap-4">
          {/* Avatar */}
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border shadow-sm">
            {typedProfile.avatar ? (
              <Image src={typedProfile.avatar} alt={initials} fill className="object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl font-bold"
                style={{ backgroundColor: '#C7EDFA', color: '#0A4F66' }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <h1
              className="font-heading text-3xl font-bold"
              style={{ color: '#031D25' }}
            >
              {typedProfile.name}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="secondary">
                {typedProfile.type === 'organization' ? 'Organization' : 'Creator'}
              </Badge>
              {typedProfile.type === 'organization' && memberCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              )}
            </div>
          </div>

          {typedProfile.description && (
            <p className="text-sm max-w-md" style={{ color: 'rgba(3,29,37,0.6)' }}>
              {typedProfile.description}
            </p>
          )}
        </div>
      </section>

      {/* Projects */}
      <section className="mx-auto max-w-2xl px-4 py-10">
        <h2
          className="font-heading text-xl font-bold mb-5"
          style={{ color: '#031D25' }}
        >
          Projects
        </h2>

        {!projects || projects.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgba(3,29,37,0.5)' }}>
            No public projects yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {(projects as Project[]).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
