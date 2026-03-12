import { createClient } from '@/lib/supabase/server'
import { ProjectCard } from '@/components/cards/ProjectCard'
import type { Project } from '@/lib/types'

export default async function ExplorePage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('publicly_visible', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const typedProjects = (projects ?? []) as Project[]

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-talwa-navy mb-2">
          Explore Projects
        </h1>
        <p className="text-talwa-navy/60">
          Browse active community engagement projects and share your perspective.
        </p>
      </div>

      {typedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🌿</div>
          <h2 className="font-heading text-xl font-semibold text-talwa-navy mb-2">
            No active projects yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Check back soon — projects will appear here when creators make them public.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {typedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
