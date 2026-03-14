export const dynamic = 'force-dynamic'

import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ProjectCard } from '@/components/cards/ProjectCard'
import { ExploreMap } from './ExploreMap'
import type { Project } from '@/lib/types'

const NEIGHBORHOOD_FILTERS = ['East Hill', 'North Hill', 'Downtown', 'Brownsville']

export default async function ExplorePage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('publicly_visible', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const typedProjects = (projects ?? []) as Project[]
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  return (
    <>
      {/* Hero */}
      <section className="w-full bg-talwa-olive-light py-20 px-4">
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center gap-6">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-talwa-navy leading-tight">
            Reimagining shared spaces. Together.
          </h1>
          <p className="text-base text-talwa-navy/70 max-w-xl">
            Browse placemaking initiatives, urban planning projects and
            community-driven spaces in your city.
          </p>

          {/* Search */}
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2 bg-white border border-border rounded-full px-4 py-3 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Enter your address or neighborhood…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-talwa-navy"
              />
            </div>
          </div>

          {/* Neighborhood filter pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {NEIGHBORHOOD_FILTERS.map((label) => (
              <button
                key={label}
                className="rounded-full border border-talwa-navy/30 px-4 py-1.5 text-sm font-medium text-talwa-navy hover:bg-talwa-navy/5 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Nearby Projects */}
      <section className="w-full bg-talwa-cream py-10 px-6 md:px-10">
        <h2 className="font-heading text-2xl font-bold text-talwa-navy mb-6">
          Nearby Projects
        </h2>

        {typedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-sm text-muted-foreground max-w-sm">
              Check back soon — projects will appear here when creators make them public.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Show up to 2 project cards */}
            {typedProjects.slice(0, 2).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}

            {/* Map panel */}
            <div className="hidden md:block rounded-xl overflow-hidden border border-border" style={{ minHeight: '320px' }}>
              <ExploreMap mapboxToken={mapboxToken} />
            </div>
          </div>
        )}
      </section>
    </>
  )
}
