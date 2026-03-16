import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProjectCard } from '@/components/cards/ProjectCard'
import type { Project, User } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function CreatorProfilePage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: creator } = await admin
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (!creator || (creator.user_type !== 'project_creator' && creator.user_type !== 'admin')) {
    notFound()
  }

  const { data: projects } = await admin
    .from('projects')
    .select('*')
    .eq('creator_id', id)
    .eq('publicly_visible', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const user = creator as User
  const initials = `${user.name_first[0] ?? ''}${user.name_last[0] ?? ''}`.toUpperCase()

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#FAFAEF' }}>
      {/* Hero */}
      <section className="w-full py-14 px-4 border-b border-border" style={{ backgroundColor: '#FAFAEF' }}>
        <div className="mx-auto max-w-2xl flex flex-col items-center text-center gap-4">
          {/* Avatar */}
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border shadow-sm">
            {user.avatar ? (
              <Image src={user.avatar} alt={initials} fill className="object-cover" />
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
              {user.name_first} {user.name_last}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(3,29,37,0.55)' }}>
              Project Creator
            </p>
          </div>
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
