'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Map, List } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProjectCard } from '@/components/cards/ProjectCard'
import { ExploreMap } from './ExploreMap'
import type { ProjectMarker } from './ExploreMap'
import type { Project } from '@/lib/types'

export default function ExplorePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([])
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)
  const [geocodedMarkers, setGeocodedMarkers] = useState<Map<string, [number, number]>>(new Map())
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
  const geocodeQueueRef = useRef<Set<string>>(new Set())

  // Fetch projects
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

  // Geocode project locations via Mapbox Geocoding API
  useEffect(() => {
    if (!mapboxToken || projects.length === 0) return

    const toGeocode = projects.filter(
      (p) => p.location && !geocodeQueueRef.current.has(p.id)
    )
    if (toGeocode.length === 0) return

    toGeocode.forEach((p) => geocodeQueueRef.current.add(p.id))

    Promise.all(
      toGeocode.map(async (p) => {
        try {
          const encoded = encodeURIComponent(p.location!)
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxToken}&limit=1&types=place,locality,neighborhood,address`
          )
          const json = await res.json()
          if (json.features?.length > 0) {
            const [lng, lat] = json.features[0].center as [number, number]
            return { id: p.id, coords: [lng, lat] as [number, number] }
          }
        } catch {
          // ignore geocode failures
        }
        return null
      })
    ).then((results) => {
      const updates = new Map(geocodedMarkers)
      results.forEach((r) => {
        if (r) updates.set(r.id, r.coords)
      })
      setGeocodedMarkers(updates)
    })
  }, [projects, mapboxToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // Extract neighborhood = first comma-delimited segment of project.location
  // e.g. "East Hill, Pensacola, FL" → "East Hill"
  const neighborhoods = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const p of projects) {
      if (p.location) {
        const hood = p.location.split(',')[0].trim()
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
          p.location?.toLowerCase().includes(q)
      )
    }
    if (selectedNeighborhoods.length > 0) {
      list = list.filter((p) => {
        const hood = p.location?.split(',')[0].trim() ?? ''
        return selectedNeighborhoods.some(
          (n) => n.toLowerCase() === hood.toLowerCase()
        )
      })
    }
    return list
  }, [projects, search, selectedNeighborhoods])

  // Build marker array for only the filtered, geocoded projects
  const visibleMarkers = useMemo<ProjectMarker[]>(() => {
    return filteredProjects
      .filter((p) => geocodedMarkers.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        coords: geocodedMarkers.get(p.id)!,
      }))
  }, [filteredProjects, geocodedMarkers])

  function toggleNeighborhood(label: string) {
    setSelectedNeighborhoods((prev) =>
      prev.includes(label) ? prev.filter((n) => n !== label) : [...prev, label]
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="w-full bg-talwa-olive-light py-16 px-4 shrink-0">
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center gap-5">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-talwa-navy leading-tight">
            Reimagining shared spaces. Together.
          </h1>
          <p className="text-base text-talwa-navy/70 max-w-xl">
            Browse placemaking initiatives, urban planning projects and
            community-driven spaces in your city.
          </p>

          {/* Search */}
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2 bg-white border border-talwa-navy/20 rounded-full px-4 py-3 shadow-sm">
              <Search className="h-4 w-4 text-talwa-navy/40 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects by name or neighborhood…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-talwa-navy/40 text-talwa-navy"
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
                    style={
                      active
                        ? { background: '#031D25', color: '#FAFAEF', borderColor: '#031D25' }
                        : { background: 'transparent', color: '#031D25', borderColor: '#031D25' }
                    }
                    className="rounded-full border px-4 py-1.5 text-sm font-medium transition-all hover:opacity-80"
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
      <div className="md:hidden flex items-center justify-end gap-2 px-4 py-2 bg-talwa-cream border-b border-border shrink-0">
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

      {/* ── Content: project list + map ────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Project list — left half on desktop */}
        <div
          className={`w-full md:w-1/2 overflow-y-auto bg-talwa-cream ${
            mobileView === 'map' ? 'hidden md:flex md:flex-col' : 'flex flex-col'
          }`}
        >
          <div className="px-6 md:px-8 py-6">
            <h2 className="font-heading text-xl font-bold text-talwa-navy mb-4">
              Nearby Projects
              {filteredProjects.length > 0 && (
                <span className="ml-2 text-base font-normal text-talwa-navy/50">
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

        {/* Map — right half on desktop */}
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
  )
}
