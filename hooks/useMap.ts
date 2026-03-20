'use client'

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

import { useRef, useEffect, useCallback, useState } from 'react'
import type { Feature, FeatureGeoJSON, Location } from '@/lib/types'

// mapbox-gl is imported dynamically to avoid SSR issues.
// Wrap any component using this hook with dynamic(() => import(...), { ssr: false })

type MapboxMap = typeof import('mapbox-gl') extends { Map: infer M } ? M : never

type UseMapOptions = {
  mapboxToken: string
  center: [number, number]
  zoom?: number
  features?: Feature[]
  drawingEnabled?: boolean
  onFeatureClick?: (feature: Feature) => void
  onMapClick?: (location: Location) => void
  onFeatureDraw?: (geojson: FeatureGeoJSON) => void
  onGeometryUpdate?: (geojson: FeatureGeoJSON) => void
  onDrawDelete?: () => void
}

// Computes a combined bounding box from all features' GeoJSON coordinates.
// Returns null if no valid coordinates are found.
function computeFeaturesBbox(features: Feature[]): [[number, number], [number, number]] | null {
  const coords: [number, number][] = []
  const flatten = (c: unknown) => {
    if (typeof (c as number[])[0] === 'number') {
      coords.push(c as [number, number])
    } else {
      ;(c as unknown[]).forEach(flatten)
    }
  }
  for (const feature of features) {
    try {
      const geojson = typeof feature.geojson === 'string' ? JSON.parse(feature.geojson) : feature.geojson
      flatten(geojson.coordinates)
    } catch { /* skip malformed geojson */ }
  }
  if (coords.length === 0) return null
  const lngs = coords.map(([lng]) => lng)
  const lats = coords.map(([, lat]) => lat)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

// Adds a single feature layer to an already-loaded map.
// Registers the layer IDs in layerFeatureMap so the global click handler can resolve clicks.
function addFeatureLayerToMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  feature: Feature,
  layerFeatureMap: Map<string, Feature>
) {
  try {
    const geojsonData =
      typeof feature.geojson === 'string'
        ? JSON.parse(feature.geojson)
        : feature.geojson

    const sourceId = `feature-source-${feature.id}`
    const layerId = `feature-layer-${feature.id}`

    if (map.getSource(sourceId)) return

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: geojsonData,
        properties: { id: feature.id, name: feature.name, type: feature.type },
      },
    })

    const geometryType: string = geojsonData.type

    if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#0A4F66', 'line-width': 3, 'line-opacity': 0.8 },
      })
      layerFeatureMap.set(layerId, feature)
    } else if (geometryType === 'Point' || geometryType === 'MultiPoint') {
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ADA739',
          'circle-stroke-color': '#031D25',
          'circle-stroke-width': 2,
        },
      })
      layerFeatureMap.set(layerId, feature)
    } else {
      // Polygon / MultiPolygon — register both fill and stroke
      const fillId = `${layerId}-fill`
      map.addLayer({
        id: fillId,
        type: 'fill',
        source: sourceId,
        paint: { 'fill-color': '#0A4F66', 'fill-opacity': 0.15 },
      })
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#0A4F66', 'line-width': 2 },
      })
      layerFeatureMap.set(fillId, feature)
      layerFeatureMap.set(layerId, feature)
    }

    // Cursor — not affected by MapboxDraw stopPropagation
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
    if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
      const fillId = `${layerId}-fill`
      map.on('mouseenter', fillId, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', fillId, () => { map.getCanvas().style.cursor = '' })
    }
  } catch (e) {
    console.error(`Failed to add feature ${feature.id}:`, e)
  }
}

export function useMap({
  mapboxToken,
  center,
  zoom = 13,
  features = [],
  drawingEnabled = false,
  onFeatureClick,
  onMapClick,
  onFeatureDraw,
  onGeometryUpdate,
  onDrawDelete,
}: UseMapOptions) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinMarkerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef = useRef<any>(null)
  const editingDrawIdRef = useRef<{ featureId: string; drawId: string } | null>(null)
  // Maps layerId → Feature; used by the early global click handler
  const layerFeatureMapRef = useRef<Map<string, Feature>>(new Map())
  // Cleanup function for direct canvas touch listeners (drawingEnabled path)
  const touchCleanupRef = useRef<(() => void) | null>(null)

  // Refs for all callbacks so event handlers captured at init always call latest versions
  const onFeatureClickRef = useRef(onFeatureClick)
  const onFeatureDrawRef = useRef(onFeatureDraw)
  const onGeometryUpdateRef = useRef(onGeometryUpdate)
  const onDrawDeleteRef = useRef(onDrawDelete)
  const onMapClickRef = useRef(onMapClick)

  useEffect(() => { onFeatureClickRef.current = onFeatureClick }, [onFeatureClick])
  useEffect(() => { onFeatureDrawRef.current = onFeatureDraw }, [onFeatureDraw])
  useEffect(() => { onGeometryUpdateRef.current = onGeometryUpdate }, [onGeometryUpdate])
  useEffect(() => { onDrawDeleteRef.current = onDrawDelete }, [onDrawDelete])
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])

  const [isLoaded, setIsLoaded] = useState(false)

  // Automatically call map.resize() whenever the container element changes size
  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any

    const initMap = async () => {
      const mapboxgl = await import('mapbox-gl')
      mapboxgl.default.accessToken = mapboxToken

      map = new mapboxgl.default.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center,
        zoom,
      })

      mapRef.current = map

      // Register our feature-click handler BEFORE MapboxDraw is initialised.
      // MapboxDraw calls stopPropagation() which blocks layer-specific handlers
      // registered via map.on('click', layerId, ...) after addControl().
      // By using a global handler here (before addControl) + queryRenderedFeatures
      // we fire first and resolve the click ourselves.
      //
      // This single handler also calls onMapClick when no feature is hit and
      // drawing is disabled (guest mode). Using one handler prevents the double-
      // fire bug where a separate onMapClick handler would clear a feature
      // selection immediately after onFeatureClick set it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('click', (e: any) => {
        const layerIds = Array.from(layerFeatureMapRef.current.keys()).filter((id) => {
          try { return !!map.getLayer(id) } catch { return false }
        })
        // Use a bounding box around the tap point to accommodate mobile touch imprecision.
        // A 20px radius buffer ensures thin lines/polygons are reliably hit on fat-finger taps.
        const bbox: [[number, number], [number, number]] = [
          [e.point.x - 20, e.point.y - 20],
          [e.point.x + 20, e.point.y + 20],
        ]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clicked: any[] = layerIds.length > 0
          ? map.queryRenderedFeatures(bbox, { layers: layerIds })
          : []
        if (clicked.length > 0) {
          const feature = layerFeatureMapRef.current.get(clicked[0].layer.id)
          if (feature) {
            onFeatureClickRef.current?.(feature)
            return
          }
        }
        // No feature hit — fire map click (guests use this to drop a pin)
        if (!drawingEnabled) {
          onMapClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }
      })

      if (drawingEnabled) {
        // MapboxDraw intercepts touchstart/touchend at the DOM level with
        // stopImmediatePropagation, so Mapbox GL never converts taps into
        // synthetic 'click' events for authenticated users on mobile.
        // We listen directly on the canvas to detect taps ourselves.
        const canvas = map.getCanvas()
        let tapStartX = 0
        let tapStartY = 0
        let tapStartTime = 0

        const onTouchStart = (e: TouchEvent) => {
          if (e.touches.length !== 1) return
          tapStartX = e.touches[0].clientX
          tapStartY = e.touches[0].clientY
          tapStartTime = Date.now()
        }

        const onTouchEnd = (e: TouchEvent) => {
          if (e.changedTouches.length !== 1) return
          const dx = e.changedTouches[0].clientX - tapStartX
          const dy = e.changedTouches[0].clientY - tapStartY
          const dt = Date.now() - tapStartTime
          // Discard drags (moved > 10px) and long-presses (> 300ms)
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10 || dt > 300) return

          const rect = canvas.getBoundingClientRect()
          const x = e.changedTouches[0].clientX - rect.left
          const y = e.changedTouches[0].clientY - rect.top

          const layerIds = Array.from(layerFeatureMapRef.current.keys()).filter((id) => {
            try { return !!map.getLayer(id) } catch { return false }
          })
          const bbox: [[number, number], [number, number]] = [
            [x - 20, y - 20],
            [x + 20, y + 20],
          ]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hit: any[] = layerIds.length > 0
            ? map.queryRenderedFeatures(bbox, { layers: layerIds })
            : []
          if (hit.length > 0) {
            const feature = layerFeatureMapRef.current.get(hit[0].layer.id)
            if (feature) onFeatureClickRef.current?.(feature)
          }
        }

        canvas.addEventListener('touchstart', onTouchStart, { passive: true })
        canvas.addEventListener('touchend', onTouchEnd, { passive: true })
        touchCleanupRef.current = () => {
          canvas.removeEventListener('touchstart', onTouchStart)
          canvas.removeEventListener('touchend', onTouchEnd)
        }

        const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default
        const draw = new MapboxDraw({
          displayControlsDefault: false,
          controls: { point: true, line_string: true, polygon: true, trash: true },
        })
        map.addControl(draw, 'top-left')
        drawRef.current = draw

        map.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
          const drawn = e.features[0]
          if (drawn?.geometry) onFeatureDrawRef.current?.(drawn.geometry as FeatureGeoJSON)
        })

        map.on('draw.update', (e: { features: GeoJSON.Feature[] }) => {
          const updated = e.features[0]
          if (updated?.geometry) onGeometryUpdateRef.current?.(updated.geometry as FeatureGeoJSON)
        })

        map.on('draw.delete', (e: { features: GeoJSON.Feature[] }) => {
          if (e.features.length === 0) onDrawDeleteRef.current?.()
        })
      }

      map.on('load', () => {
        setIsLoaded(true)
        features.forEach((feature) => {
          addFeatureLayerToMap(map, feature, layerFeatureMapRef.current)
        })

        // Snap camera to the geographic extent of all features
        if (features.length > 0) {
          const bbox = computeFeaturesBbox(features)
          if (bbox) {
            const [[minLng, minLat], [maxLng, maxLat]] = bbox
            if (minLng === maxLng && minLat === maxLat) {
              map.flyTo({ center: [minLng, minLat], zoom: 15 })
            } else {
              map.fitBounds(bbox, { padding: 80, maxZoom: 16, duration: 0 })
            }
          }
        }
      })

    }

    initMap()

    return () => {
      touchCleanupRef.current?.()
      touchCleanupRef.current = null
      map?.remove()
      mapRef.current = null
      drawRef.current = null
      layerFeatureMapRef.current.clear()
    }
  }, []) // Empty deps — map initialized once on mount

  const flyTo = useCallback((lngLat: [number, number], targetZoom?: number) => {
    mapRef.current?.flyTo({ center: lngLat, zoom: targetZoom ?? 15 })
  }, [])

  const flyToFeature = useCallback((feature: Feature) => {
    const map = mapRef.current
    if (!map) return
    const geojson = typeof feature.geojson === 'string'
      ? JSON.parse(feature.geojson)
      : feature.geojson
    const type: string = geojson.type
    if (type === 'Point') {
      const [lng, lat] = geojson.coordinates as [number, number]
      map.flyTo({ center: [lng, lat], zoom: 15 })
    } else {
      // Compute bounding box for LineString, Polygon, Multi* variants
      const coords: [number, number][] = []
      const flatten = (c: unknown) => {
        if (typeof (c as number[])[0] === 'number') {
          coords.push(c as [number, number])
        } else {
          ;(c as unknown[]).forEach(flatten)
        }
      }
      flatten(geojson.coordinates)
      if (coords.length === 0) return
      const lngs = coords.map(([lng]) => lng)
      const lats = coords.map(([, lat]) => lat)
      const bbox: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ]
      map.fitBounds(bbox, { padding: 80, maxZoom: 16 })
    }
  }, [])

  const addPin = useCallback((location: Location) => {
    import('mapbox-gl').then((mapboxgl) => {
      if (pinMarkerRef.current) pinMarkerRef.current.remove()
      const el = document.createElement('div')
      el.className = 'w-6 h-6 rounded-full bg-talwa-burnt-orange border-2 border-white shadow-lg cursor-pointer'
      const marker = new mapboxgl.default.Marker({ element: el })
        .setLngLat([location.lng, location.lat])
        .addTo(mapRef.current!)
      pinMarkerRef.current = marker
    })
  }, [])

  const removePin = useCallback(() => {
    if (pinMarkerRef.current) {
      pinMarkerRef.current.remove()
      pinMarkerRef.current = null
    }
  }, [])

  const filterToDataPoints = useCallback(
    (dataPoints: Array<{ id: string; location: Location | null }>) => {
      if (!mapRef.current || !isLoaded) return
      const map = mapRef.current
      const sourceId = 'data-points-source'
      const geojsonData = {
        type: 'FeatureCollection' as const,
        features: dataPoints
          .filter((dp) => dp.location)
          .map((dp) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [dp.location!.lng, dp.location!.lat] },
            properties: { id: dp.id },
          })),
      }
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(geojsonData)
      } else {
        map.addSource(sourceId, { type: 'geojson', data: geojsonData, cluster: true })
        map.addLayer({
          id: 'data-points-layer',
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': 6,
            'circle-color': '#BD4F00',
            'circle-stroke-color': '#FAFAEF',
            'circle-stroke-width': 2,
          },
        })
      }
    },
    [isLoaded]
  )

  const highlightFeatures = useCallback((featureIds: string[]) => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    const highlighted = new Set(featureIds)
    const seen = new Set<string>()
    for (const feature of layerFeatureMapRef.current.values()) {
      if (seen.has(feature.id)) continue
      seen.add(feature.id)
      const layerId = `feature-layer-${feature.id}`
      const fillId = `${layerId}-fill`
      const isHl = highlighted.size > 0 && highlighted.has(feature.id)
      try {
        if (map.getLayer(fillId)) {
          map.setPaintProperty(fillId, 'fill-color', isHl ? '#ADA739' : '#0A4F66')
          map.setPaintProperty(fillId, 'fill-opacity', isHl ? 0.35 : 0.15)
        }
        if (map.getLayer(layerId)) {
          const type = map.getLayer(layerId).type
          if (type === 'line') {
            map.setPaintProperty(layerId, 'line-color', isHl ? '#ADA739' : '#0A4F66')
            map.setPaintProperty(layerId, 'line-width', isHl ? 3 : 2)
          } else if (type === 'circle') {
            map.setPaintProperty(layerId, 'circle-color', isHl ? '#BD4F00' : '#ADA739')
          }
        }
      } catch { /* layer may not exist */ }
    }
  }, [isLoaded])

  const addFeatureLayer = useCallback((feature: Feature) => {
    if (!mapRef.current) return
    addFeatureLayerToMap(mapRef.current, feature, layerFeatureMapRef.current)
  }, [])

  const removeFeatureLayer = useCallback((featureId: string) => {
    const map = mapRef.current
    if (!map) return
    const sourceId = `feature-source-${featureId}`
    const layerId = `feature-layer-${featureId}`
    const fillLayerId = `${layerId}-fill`
    layerFeatureMapRef.current.delete(layerId)
    layerFeatureMapRef.current.delete(fillLayerId)
    if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId)
    if (map.getLayer(layerId)) map.removeLayer(layerId)
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  }, [])

  const startEditGeometry = useCallback((feature: Feature) => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw) return
    const geojsonData =
      typeof feature.geojson === 'string' ? JSON.parse(feature.geojson) : feature.geojson
    const ids = draw.add({ type: 'Feature', geometry: geojsonData, properties: {} }) as string[]
    const drawId = ids[0]
    editingDrawIdRef.current = { featureId: feature.id, drawId }
    draw.changeMode('direct_select', { featureId: drawId })
    const layerId = `feature-layer-${feature.id}`
    const fillId = `${layerId}-fill`
    if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', 'none')
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none')
  }, [])

  const stopEditGeometry = useCallback((featureId: string) => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw) return
    if (editingDrawIdRef.current?.featureId === featureId) {
      draw.delete(editingDrawIdRef.current.drawId)
      editingDrawIdRef.current = null
    }
    draw.changeMode('simple_select')
    const layerId = `feature-layer-${featureId}`
    const fillId = `${layerId}-fill`
    if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', 'visible')
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'visible')
  }, [])

  const cancelDraw = useCallback(() => {
    if (drawRef.current) {
      drawRef.current.deleteAll()
      editingDrawIdRef.current = null
    }
  }, [])

  return {
    mapContainerRef,
    isLoaded,
    flyTo,
    flyToFeature,
    addPin,
    removePin,
    filterToDataPoints,
    highlightFeatures,
    addFeatureLayer,
    removeFeatureLayer,
    startEditGeometry,
    stopEditGeometry,
    cancelDraw,
  }
}
