'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useMap } from '@/hooks/useMap'
import type { Feature, DataPoint } from '@/lib/types'

type InsightsMapProps = {
  mapboxToken: string
  center: [number, number]
  zoom?: number
  features: Feature[]
  dataPoints: DataPoint[]
  selectedThemeId?: string | null
  className?: string
  onDataPointClick?: (dataPoint: DataPoint) => void
  onFeatureClick?: (feature: Feature) => void
}

export function InsightsMap({
  mapboxToken,
  center,
  zoom,
  features,
  dataPoints,
  selectedThemeId,
  className,
  onDataPointClick,
  onFeatureClick,
}: InsightsMapProps) {
  const { mapContainerRef, filterToDataPoints, isLoaded } = useMap({
    mapboxToken,
    center,
    zoom,
    features,
    onFeatureClick,
  })

  // Filter data points when theme selection changes
  const filteredDataPoints = selectedThemeId
    ? dataPoints.filter((dp) => dp.theme_ids.includes(selectedThemeId))
    : dataPoints

  useEffect(() => {
    if (isLoaded) {
      filterToDataPoints(filteredDataPoints)
    }
  }, [filteredDataPoints, isLoaded, filterToDataPoints])

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-talwa-navy shadow-sm border border-talwa-sky">
        {filteredDataPoints.filter((dp) => dp.location).length} located data points
        {selectedThemeId && ' (filtered)'}
      </div>
    </div>
  )
}
