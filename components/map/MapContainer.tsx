'use client'

import { cn } from '@/lib/utils'
import { useMap } from '@/hooks/useMap'
import type { Feature, Location } from '@/lib/types'

type MapContainerProps = {
  mapboxToken: string
  center: [number, number]
  zoom?: number
  features?: Feature[]
  className?: string
  onFeatureClick?: (feature: Feature) => void
  onMapClick?: (location: Location) => void
}

export function MapContainer({
  mapboxToken,
  center,
  zoom,
  features = [],
  className,
  onFeatureClick,
  onMapClick,
}: MapContainerProps) {
  const { mapContainerRef } = useMap({
    mapboxToken,
    center,
    zoom,
    features,
    onFeatureClick,
    onMapClick,
  })

  return (
    <div
      ref={mapContainerRef}
      className={cn('w-full h-full', className)}
      style={{ minHeight: '300px' }}
    />
  )
}
