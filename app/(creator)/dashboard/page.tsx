import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectCard } from '@/components/cards/ProjectCard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { Project } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('creator_id', authUser.id)
    .order('created_at', { ascending: false })

  const typedProjects = (projects ?? []) as Project[]

  // Quick stats
  const activeCount = typedProjects.filter((p) => p.status === 'active').length
  const totalContributors = typedProjects.reduce(
    (sum, p) => sum + p.contributor_count,
    0
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-talwa-navy">Dashboard</h1>
          <p className="text-talwa-navy/60 mt-1">Manage your community engagement projects</p>
        </div>
        <Button asChild>
          <Link href="/creator/projects/new">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total projects', value: typedProjects.length },
          { label: 'Active projects', value: activeCount },
          { label: 'Total contributors', value: totalContributors },
          { label: 'Drafts', value: typedProjects.filter((p) => p.status === 'draft').length },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-border p-4">
            <p className="text-2xl font-bold text-talwa-navy font-heading">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Projects */}
      {typedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-2xl">
          <div className="text-4xl mb-4">🌱</div>
          <h2 className="font-heading text-xl font-semibold text-talwa-navy mb-2">
            No projects yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Create your first project to start collecting community insights.
          </p>
          <Button asChild>
            <Link href="/creator/projects/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-4">Your Projects</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {typedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
