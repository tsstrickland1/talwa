'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Map, List } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProjectCard } from '@/components/cards/ProjectCard'
import { ExploreMap } from './ExploreMap'
import type { Project } from '@/lib/types'

export default function ExplorePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([])
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('projects')
      .select('*')
      .eq('publicly_visible', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProjects((data ?? []) as Project[]))
  }, [])

  // Derive neighborhood list from project locations
  const neighborhoods = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const p of projects) {
      if (p.location) {
        const label = p.location.trim()
        if (label && !seen.has(label)) {
          seen.add(label)
          result.push(label)
        }
      }
    }
    return result
  }, [projects])

  const filteredProjects = useMemo(() => {
    let list = projects
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.short_description?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q)
      )
    }
    if (selectedNeighborhoods.length > 0) {
      list = list.filter((p) =>
        selectedNeighborhoods.some((n) =>
          p.location?.toLowerCase().includes(n.toLowerCase())
        )
      )
    }
    return list
  }, [projects, search, selectedNeighborhoods])

  function toggleNeighborhood(label: string) {
    setSelectedNeighborhoods((prev) =>
      prev.includes(label) ? prev.filter((n) => n !== label) : [...prev, label]
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Hero */}
      <section className="w-full bg-talwa-navy py-16 px-4">
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center gap-6">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-talwa-cream leading-tight">
            Reimagining shared spaces. Together.
          </h1>
          <p className="text-base text-talwa-cream/70 max-w-xl">
            Browse placemaking initiatives, urban planning projects and
            community-driven spaces in your city.
          </p>

          {/* Search */}
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2 bg-talwa-navy/60 border border-talwa-cream/20 rounded-full px-4 py-3 shadow-sm">
              <Search className="h-4 w-4 text-talwa-cream/50 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects by name or neighborhood…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-talwa-cream/40 text-talwa-cream"
              />
            </div>
          </div>

          {/* Neighborhood filter pills */}
          {neighborhoods.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {neighborhoods.map((label) => {
                const active = selectedNeighborhoods.includes(label)
                return (
                  <button
                    key={label}
                    onClick={() => toggleNeighborhood(label)}
                    className={
                      active
                        ? 'rounded-full px-4 py-1.5 text-sm font-medium bg-talwa-teal text-white transition-colors'
                        : 'rounded-full border border-talwa-cream/30 px-4 py-1.5 text-sm font-medium text-talwa-cream/80 hover:bg-talwa-cream/10 transition-colors'
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Mobile view toggle */}
      <div className="md:hidden flex items-center justify-end gap-2 px-4 py-2 bg-talwa-cream border-b border-border">
        <button
          onClick={() => setMobileView('map')}
          className={
            mobileView === 'map'
              ? 'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-talwa-teal text-white'
              : 'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-border text-talwa-navy hover:bg-accent'
          }
        >
          <Map className="w-3.5 h-3.5" />
          Map
        </button>
        <button
          onClick={() => setMobileView('list')}
          className={
            mobileView === 'list'
              ? 'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-talwa-teal text-white'
              : 'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-border text-talwa-navy hover:bg-accent'
          }
        >
          <List className="w-3.5 h-3.5" />
          List
        </button>
      </div>

      {/* Main content: split layout on desktop, toggle on mobile */}
      <div className="flex flex-1 min-h-0" style={{ height: 'calc(100vh - 13rem)' }}>
        {/* Project list — left half desktop, full width mobile (when list view) */}
        <div
          className={`w-full md:w-1/2 overflow-y-auto bg-talwa-cream ${
            mobileView === 'map' ? 'hidden md:block' : 'block'
          }`}
        >
          <div className="px-6 md:px-8 py-6">
            <h2 className="font-heading text-xl font-bold text-talwa-navy mb-4">
              {filteredProjects.length === 0
                ? 'No projects found'
                : `${filteredProjects.length} project${filteredProjects.length === 1 ? '' : 's'}`}
            </h2>

            {filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-sm text-muted-foreground max-w-sm">
                  {projects.length === 0
                    ? 'Check back soon — projects will appear here when creators make them public.'
                    : 'No projects match your search. Try adjusting your filters.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map — right half desktop, full width mobile (when map view) */}
        <div
          className={`w-full md:w-1/2 md:block sticky top-0 ${
            mobileView === 'list' ? 'hidden' : 'block'
          }`}
        >
          <ExploreMap mapboxToken={mapboxToken} />
        </div>
      </div>
    </div>
  )
}
