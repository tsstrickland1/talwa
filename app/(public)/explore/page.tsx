'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Search, Map as MapIcon, List } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProjectCard } from '@/components/cards/ProjectCard'
import type { ProjectMarker } from './ExploreMap'
import type { Project } from '@/lib/types'

const ExploreMap = dynamic(
  () => import('./ExploreMap').then((m) => m.ExploreMap),
  { ssr: false }
)

export default function ExplorePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([])
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)
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

  // Neighborhood pills: distinct non-null neighborhood values from the DB
  const neighborhoods = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const p of projects) {
      if (p.neighborhood) {
        const hood = p.neighborhood.trim()
        if (hood && !seen.has(hood)) {
          seen.add(hood)
          result.push(hood)
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
          p.location?.toLowerCase().includes(q) ||
          p.neighborhood?.toLowerCase().includes(q)
      )
    }
    if (selectedNeighborhoods.length > 0) {
      list = list.filter((p) =>
        p.neighborhood
          ? selectedNeighborhoods.some(
              (n) => n.toLowerCase() === p.neighborhood!.toLowerCase()
            )
          : false
      )
    }
    return list
  }, [projects, search, selectedNeighborhoods])

  // Build marker array from filtered projects that have coordinates in the DB
  const visibleMarkers = useMemo<ProjectMarker[]>(() => {
    return filteredProjects
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ id: p.id, name: p.name, coords: [p.lng!, p.lat!] }))
  }, [filteredProjects])

  function toggleNeighborhood(label: string) {
    setSelectedNeighborhoods((prev) =>
      prev.includes(label) ? prev.filter((n) => n !== label) : [...prev, label]
    )
  }

  return (
    <div className="flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────── */}
      {/* bg-talwa-olive-light via explicit hex in case Tailwind class isn't yet compiled */}
      <section
        className="w-full py-16 px-4 shrink-0"
        style={{ backgroundColor: '#DBD894' }}
      >
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center gap-5">
          <h1
            className="font-heading text-4xl md:text-5xl font-bold leading-tight"
            style={{ color: '#031D25' }}
          >
            Reimagining shared spaces. Together.
          </h1>
          <p className="text-base max-w-xl" style={{ color: 'rgba(3,29,37,0.7)' }}>
            Browse placemaking initiatives, urban planning projects and
            community-driven spaces in your city.
          </p>

          {/* Search */}
          <div className="w-full max-w-xl">
            <div
              className="flex items-center gap-2 rounded-full px-4 py-3 shadow-sm"
              style={{ backgroundColor: '#fff', border: '1px solid rgba(3,29,37,0.18)' }}
            >
              <Search className="h-4 w-4 shrink-0" style={{ color: 'rgba(3,29,37,0.4)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects by name or neighborhood…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#031D25' }}
              />
            </div>
          </div>

          {/* Neighborhood filter pills — derived from project.neighborhood in DB */}
          {neighborhoods.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {neighborhoods.map((label) => {
                const active = selectedNeighborhoods.includes(label)
                return (
                  <button
                    key={label}
                    onClick={() => toggleNeighborhood(label)}
                    className="rounded-full border px-4 py-1.5 text-sm font-medium transition-all hover:opacity-80"
                    style={
                      active
                        ? { backgroundColor: '#031D25', color: '#FAFAEF', borderColor: '#031D25' }
                        : { backgroundColor: 'transparent', color: '#031D25', borderColor: '#031D25' }
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

      {/* ── Sticky two-column area ────────────────────────────────
           The entire panel (toggle + list + map) sticks below the nav
           once the hero scrolls off. Inline style is required because
           Tailwind's calc() arbitrary values require spaces around the
           minus operator which Tailwind does not reliably preserve.
           The list scrolls internally; the map always fills its column. */}
      <div
        className="sticky top-14 flex flex-col"
        style={{ height: 'calc(100vh - 3.5rem)', '--map-h': 'calc(100vh - 3.5rem)' } as React.CSSProperties}
      >
        {/* Mobile view toggle — lives inside the sticky panel */}
        <div
          className="md:hidden flex items-center justify-end px-4 py-2 border-b border-border shrink-0"
          style={{ backgroundColor: '#FAFAEF' }}
        >
          <div className="flex rounded-md border border-border overflow-hidden shadow-sm">
            <button
              onClick={() => setMobileView('list')}
              className="p-2 transition-colors"
              style={mobileView === 'list' ? { backgroundColor: '#0A4F66', color: '#FAFAEF' } : { color: '#031D25' }}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileView('map')}
              className="p-2 border-l border-border transition-colors"
              style={mobileView === 'map' ? { backgroundColor: '#0A4F66', color: '#FAFAEF' } : { color: '#031D25' }}
              aria-label="Map view"
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Columns — fill the remaining height of the sticky panel */}
        <div className="flex flex-1 min-h-0">
          {/* Project list — scrolls internally */}
          <div
            className={`w-full md:w-1/2 overflow-y-auto ${
              mobileView === 'map' ? 'hidden md:flex md:flex-col' : 'flex flex-col'
            }`}
            style={{ backgroundColor: '#FAFAEF' }}
          >
            <div className="px-6 md:px-8 py-6">
              <h2
                className="font-heading text-xl font-bold mb-4"
                style={{ color: '#031D25' }}
              >
                Nearby Projects
                {filteredProjects.length > 0 && (
                  <span className="ml-2 text-base font-normal" style={{ color: 'rgba(3,29,37,0.45)' }}>
                    ({filteredProjects.length})
                  </span>
                )}
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
                    <div
                      key={project.id}
                      id={`project-card-${project.id}`}
                      onMouseEnter={() => setHoveredProjectId(project.id)}
                      onMouseLeave={() => setHoveredProjectId(null)}
                    >
                      <ProjectCard project={project} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map — the sticky panel above sets --map-h as a CSS custom property.
               ExploreMap uses var(--map-h) as an explicitly specified height so that
               Mapbox reads the correct canvas size on initialisation. */}
          <div
            className={`w-full md:w-1/2 h-full ${
              mobileView === 'list' ? 'hidden md:block' : 'block'
            }`}
          >
            <ExploreMap
              mapboxToken={mapboxToken}
              projects={visibleMarkers}
              hoveredProjectId={hoveredProjectId}
              onProjectClick={(id) => {
                const el = document.getElementById(`project-card-${id}`)
                el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                setHoveredProjectId(id)
                setTimeout(() => setHoveredProjectId(null), 1500)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
