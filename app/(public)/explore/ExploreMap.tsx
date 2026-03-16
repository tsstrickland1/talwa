'use client'

import { useRef, useEffect } from 'react'

export type ProjectMarker = {
  id: string
  name: string
  coords: [number, number] // [lng, lat]
}

type Props = {
  mapboxToken: string
  projects: ProjectMarker[]
  hoveredProjectId: string | null
  onProjectClick?: (id: string) => void
}

const NORMAL_COLOR = '#0A4F66'   // talwa-teal
const HOVERED_COLOR = '#BD4F00'  // talwa-burnt-orange
const STROKE_COLOR = '#FAFAEF'   // talwa-cream

function makeMarkerEl(hovered: boolean): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'width:14px',
    'height:14px',
    'border-radius:50%',
    `background:${hovered ? HOVERED_COLOR : NORMAL_COLOR}`,
    `border:2px solid ${STROKE_COLOR}`,
    'box-shadow:0 1px 4px rgba(0,0,0,0.3)',
    'cursor:pointer',
    'transition:all 0.15s ease',
  ].join(';')
  if (hovered) {
    el.style.width = '18px'
    el.style.height = '18px'
    el.style.zIndex = '10'
  }
  return el
}

export function ExploreMap({
  mapboxToken,
  projects,
  hoveredProjectId,
  onProjectClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, { marker: any; el: HTMLDivElement }>>(new Map())
  const mapReadyRef = useRef(false)
  const pendingProjectsRef = useRef<ProjectMarker[]>([])

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mapboxgl as any).accessToken = mapboxToken

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-122.6587, 45.5122], // Portland, OR
        zoom: 11,
      })

      mapRef.current = map

      const flushPending = () => {
        if (mapReadyRef.current) return
        mapReadyRef.current = true
        if (pendingProjectsRef.current.length > 0) {
          renderMarkers(mapboxgl, map, pendingProjectsRef.current, null, onProjectClick)
          fitBounds(map, pendingProjectsRef.current)
          pendingProjectsRef.current = []
        }
      }

      map.on('load', flushPending)
      // Fallback: 'idle' fires after the map settles even if tiles fail (e.g. invalid token in dev)
      map.once('idle', flushPending)
      // Fallback: on error still attempt to render markers so they appear on a degraded map
      map.on('error', flushPending)
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      mapReadyRef.current = false
      markersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resize map when container dimensions change (e.g. sticky layout settling)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Update markers when projects change
  useEffect(() => {
    if (!projects.length) return

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!mapRef.current || !mapReadyRef.current) {
        pendingProjectsRef.current = projects
        return
      }
      renderMarkers(mapboxgl, mapRef.current, projects, hoveredProjectId, onProjectClick)
      fitBounds(mapRef.current, projects)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects])

  // Update hover styling without re-rendering all markers
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => {
      const hovered = id === hoveredProjectId
      el.style.background = hovered ? HOVERED_COLOR : NORMAL_COLOR
      el.style.width = hovered ? '18px' : '14px'
      el.style.height = hovered ? '18px' : '14px'
      el.style.zIndex = hovered ? '10' : ''
    })
  }, [hoveredProjectId])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderMarkers(mapboxgl: any, map: any, pts: ProjectMarker[], hovered: string | null, onClick?: (id: string) => void) {
    // Remove stale markers
    const incoming = new Set(pts.map((p) => p.id))
    markersRef.current.forEach(({ marker }, id) => {
      if (!incoming.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    pts.forEach((p) => {
      if (markersRef.current.has(p.id)) {
        // Update position in case coords changed
        markersRef.current.get(p.id)!.marker.setLngLat(p.coords)
        return
      }
      const el = makeMarkerEl(p.id === hovered)
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(p.coords)
        .setPopup(new mapboxgl.Popup({ offset: 12, closeButton: false, className: 'talwa-popup' })
          .setHTML(`<span style="font-family:sans-serif;font-size:12px;color:#031D25">${p.name}</span>`))
        .addTo(map)

      el.addEventListener('click', () => onClick?.(p.id))
      el.addEventListener('mouseenter', () => marker.getPopup()?.addTo(map))
      el.addEventListener('mouseleave', () => marker.getPopup()?.remove())

      markersRef.current.set(p.id, { marker, el })
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fitBounds(map: any, pts: ProjectMarker[]) {
    if (pts.length === 0) return
    if (pts.length === 1) {
      map.flyTo({ center: pts[0].coords, zoom: 13, duration: 800 })
      return
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    pts.forEach(({ coords: [lng, lat] }) => {
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    })
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 14, duration: 800 })
  }

  return (
    <div className="h-full w-full" style={{ minHeight: '400px' }}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
