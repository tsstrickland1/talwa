'use client'

import { useChat } from 'ai/react'
import { useState, useCallback, useEffect } from 'react'
import type { Message } from 'ai'
import type { Location, Feature, FeatureGeoJSON } from '@/lib/types'

export type SurfacedContent =
  | { type: 'theme'; theme_id: string }
  | { type: 'data_point'; data_point_id: string }
  | { type: 'themes_overview' }
  | null

// Compute bbox centroid of a GeoJSON geometry as a best-effort location for the pin.
export function computeCentroid(geojson: FeatureGeoJSON): Location {
  type Coord = [number, number]

  function collectCoords(g: FeatureGeoJSON): Coord[] {
    switch (g.type) {
      case 'Point':
        return [g.coordinates as Coord]
      case 'MultiPoint':
      case 'LineString':
        return g.coordinates as Coord[]
      case 'MultiLineString':
      case 'Polygon':
        return (g.coordinates as Coord[][]).flat()
      case 'MultiPolygon':
        return (g.coordinates as Coord[][][]).flat(2)
      case 'GeometryCollection':
        return g.geometries.flatMap(collectCoords)
      default:
        return []
    }
  }

  const coords = collectCoords(geojson)
  if (coords.length === 0) return { lat: 0, lng: 0 }

  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
}

export function useFacilitator({
  projectId,
  conversationId,
  vectorStoreId = null,
}: {
  projectId: string
  conversationId: string | null
  vectorStoreId?: string | null
}) {
  const [activePin, setActivePin] = useState<Location | null>(null)
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [contributorDrew, setContributorDrew] = useState(false)
  const [surfacedContent, setSurfacedContent] = useState<SurfacedContent>(null)
  const [initialMessages, setInitialMessages] = useState<Message[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  useEffect(() => {
    if (!conversationId) {
      setHistoryLoaded(true)
      return
    }
    fetch(`/api/facilitator/messages?conversation_id=${conversationId}`)
      .then((res) => res.json())
      .then(({ messages }) => {
        setInitialMessages(messages ?? [])
        setHistoryLoaded(true)
      })
      .catch(() => {
        setHistoryLoaded(true)
      })
  }, [conversationId])

  const chat = useChat({
    api: '/api/facilitator',
    initialMessages,
    body: {
      location: activePin,
      feature_id: activeFeature?.id ?? null,
      contributor_drew: contributorDrew,
      project_id: projectId,
      conversation_id: conversationId,
      vector_store_id: vectorStoreId,
    },
    onToolCall: ({ toolCall }) => {
      switch (toolCall.toolName) {
        case 'reset_location':
          setActivePin(null)
          setActiveFeature(null)
          setContributorDrew(false)
          break
        case 'surface_theme': {
          const themeId = (toolCall.args as { theme_id: string | null }).theme_id
          if (themeId === null) {
            setSurfacedContent({ type: 'themes_overview' })
          } else {
            setSurfacedContent({ type: 'theme', theme_id: themeId })
          }
          break
        }
        case 'surface_data_point': {
          const dpId = (toolCall.args as { data_point_id: string }).data_point_id
          setSurfacedContent({ type: 'data_point', data_point_id: dpId })
          break
        }
      }
    },
  })

  const pinLocation = useCallback(
    (location: Location, feature?: Feature) => {
      setActivePin(location)
      setActiveFeature(feature ?? null)
      setContributorDrew(false)
    },
    []
  )

  // Called after a contributor successfully draws and saves a feature.
  // Sets the new feature as the active context and computes a centroid pin.
  const activateDrawnFeature = useCallback((feature: Feature) => {
    const geojson: FeatureGeoJSON =
      typeof feature.geojson === 'string'
        ? (JSON.parse(feature.geojson) as FeatureGeoJSON)
        : (feature.geojson as unknown as FeatureGeoJSON)
    const centroid = computeCentroid(geojson)
    setActivePin(centroid)
    setActiveFeature(feature)
    setContributorDrew(true)
  }, [])

  const clearPin = useCallback(() => {
    setActivePin(null)
    setActiveFeature(null)
    setContributorDrew(false)
  }, [])

  const clearSurface = useCallback(() => {
    setSurfacedContent(null)
  }, [])

  return {
    ...chat,
    activePin,
    activeFeature,
    contributorDrew,
    surfacedContent,
    historyLoaded,
    pinLocation,
    activateDrawnFeature,
    clearPin,
    clearSurface,
  }
}
