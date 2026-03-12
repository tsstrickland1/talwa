'use client'

import { useChat } from 'ai/react'
import { useState, useCallback } from 'react'
import type { Location, Feature } from '@/lib/types'

export type SurfacedContent =
  | { type: 'theme'; theme_id: string }
  | { type: 'data_point'; data_point_id: string }
  | { type: 'themes_overview' }
  | null

export function useFacilitator({
  projectId,
  conversationId,
}: {
  projectId: string
  conversationId: string
}) {
  const [activePin, setActivePin] = useState<Location | null>(null)
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [surfacedContent, setSurfacedContent] = useState<SurfacedContent>(null)

  const chat = useChat({
    api: '/api/facilitator',
    body: {
      location: activePin,
      feature_id: activeFeature?.id ?? null,
      project_id: projectId,
      conversation_id: conversationId,
    },
    onToolCall: ({ toolCall }) => {
      switch (toolCall.toolName) {
        case 'reset_location':
          setActivePin(null)
          setActiveFeature(null)
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
    },
    []
  )

  const clearPin = useCallback(() => {
    setActivePin(null)
    setActiveFeature(null)
  }, [])

  const clearSurface = useCallback(() => {
    setSurfacedContent(null)
  }, [])

  return {
    ...chat,
    activePin,
    activeFeature,
    surfacedContent,
    pinLocation,
    clearPin,
    clearSurface,
  }
}
