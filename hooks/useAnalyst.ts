'use client'

import { useChat } from 'ai/react'
import { useState, useCallback } from 'react'

export type AnalystSurfacedContent =
  | { type: 'theme'; theme_id: string }
  | { type: 'data_point'; data_point_id: string }
  | { type: 'themes_overview' }
  | null

export function useAnalyst({ projectId }: { projectId: string }) {
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null)
  const [selectedDataPointId, setSelectedDataPointId] = useState<string | null>(null)
  const [surfacedContent, setSurfacedContent] = useState<AnalystSurfacedContent>(null)

  const chat = useChat({
    api: '/api/analyst',
    body: {
      project_id: projectId,
      selected_theme_id: selectedThemeId,
      selected_data_point_id: selectedDataPointId,
    },
    onToolCall: ({ toolCall }) => {
      switch (toolCall.toolName) {
        case 'surface_theme': {
          const themeId = (toolCall.args as { theme_id: string | null }).theme_id
          if (themeId === null) {
            setSelectedThemeId(null)
            setSurfacedContent({ type: 'themes_overview' })
          } else {
            setSelectedThemeId(themeId)
            setSurfacedContent({ type: 'theme', theme_id: themeId })
          }
          break
        }
        case 'query_data_points':
        case 'get_feature_summary':
          // These are data-fetching tools — results appear in the message stream
          break
      }
    },
  })

  const selectTheme = useCallback((themeId: string) => {
    setSelectedThemeId(themeId)
    setSurfacedContent({ type: 'theme', theme_id: themeId })
  }, [])

  const selectDataPoint = useCallback((dataPointId: string) => {
    setSelectedDataPointId(dataPointId)
    setSurfacedContent({ type: 'data_point', data_point_id: dataPointId })
  }, [])

  const resetToOverview = useCallback(() => {
    setSelectedThemeId(null)
    setSelectedDataPointId(null)
    setSurfacedContent({ type: 'themes_overview' })
  }, [])

  return {
    ...chat,
    selectedThemeId,
    selectedDataPointId,
    surfacedContent,
    selectTheme,
    selectDataPoint,
    resetToOverview,
  }
}
