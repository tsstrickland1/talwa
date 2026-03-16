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
}

// Adds a single feature layer to an already-loaded map.
// Extracted so it can be called both at init time and dynamically after draw.
function addFeatureLayerToMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  feature: Feature,
  onFeatureClick?: (feature: Feature) => void
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
        paint: {
          'line-color': '#0A4F66',
          'line-width': 3,
          'line-opacity': 0.8,
        },
      })
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
    } else {
      // Polygon / MultiPolygon
      map.addLayer({
        id: `${layerId}-fill`,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#0A4F66',
          'fill-opacity': 0.15,
        },
      })
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#0A4F66',
          'line-width': 2,
        },
      })
    }

    map.on('click', layerId, () => {
      onFeatureClick?.(feature)
    })

    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = ''
    })
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
}: UseMapOptions) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinMarkerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)

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

      if (drawingEnabled) {
        const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default
        const draw = new MapboxDraw({
          displayControlsDefault: false,
          controls: {
            point: true,
            line_string: true,
            polygon: true,
            trash: true,
          },
        })
        map.addControl(draw, 'top-left')
        drawRef.current = draw

        map.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
          const drawn = e.features[0]
          if (drawn?.geometry) {
            onFeatureDraw?.(drawn.geometry as FeatureGeoJSON)
          }
        })
      }

      map.on('load', () => {
        setIsLoaded(true)

        features.forEach((feature) => {
          addFeatureLayerToMap(map, feature, onFeatureClick)
        })
      })

      map.on('click', () => {
        // Only fire if not clicking a feature layer
        // Note: layer-specific handlers above take precedence
      })

      map.on('click', (e: { lngLat: { lat: number; lng: number } }) => {
        onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })
    }

    initMap()

    return () => {
      map?.remove()
      mapRef.current = null
      drawRef.current = null
    }
  }, []) // Empty deps — map initialized once on mount

  const flyTo = useCallback((lngLat: [number, number], targetZoom?: number) => {
    mapRef.current?.flyTo({ center: lngLat, zoom: targetZoom ?? 15 })
  }, [])

  const addPin = useCallback((location: Location) => {
    import('mapbox-gl').then((mapboxgl) => {
      // Remove existing pin
      if (pinMarkerRef.current) {
        pinMarkerRef.current.remove()
      }

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
            geometry: {
              type: 'Point' as const,
              coordinates: [dp.location!.lng, dp.location!.lat],
            },
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

  // Add a single feature layer after map load (used for dynamically-drawn features)
  const addFeatureLayer = useCallback(
    (feature: Feature) => {
      if (!mapRef.current || !isLoaded) return
      addFeatureLayerToMap(mapRef.current, feature, onFeatureClick)
    },
    [isLoaded, onFeatureClick]
  )

  // Remove the last drawn shape from the draw control (called on modal cancel)
  const cancelDraw = useCallback(() => {
    if (drawRef.current) {
      drawRef.current.deleteAll()
    }
  }, [])

  return {
    mapContainerRef,
    isLoaded,
    flyTo,
    addPin,
    removePin,
    filterToDataPoints,
    addFeatureLayer,
    cancelDraw,
  }
}
