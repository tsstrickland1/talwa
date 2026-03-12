'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useMap } from '@/hooks/useMap'
import type { Feature, Location } from '@/lib/types'

type ContributorMapProps = {
  mapboxToken: string
  center: [number, number]
  zoom?: number
  features: Feature[]
  activePin: Location | null
  className?: string
  onFeatureClick?: (feature: Feature) => void
  onMapClick?: (location: Location) => void
}

export function ContributorMap({
  mapboxToken,
  center,
  zoom,
  features,
  activePin,
  className,
  onFeatureClick,
  onMapClick,
}: ContributorMapProps) {
  const { mapContainerRef, addPin, removePin } = useMap({
    mapboxToken,
    center,
    zoom,
    features,
    onFeatureClick,
    onMapClick,
  })

  // Sync pin with activePin state
  useEffect(() => {
    if (activePin) {
      addPin(activePin)
    } else {
      removePin()
    }
  }, [activePin, addPin, removePin])

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {activePin && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-talwa-navy shadow-sm border border-talwa-sky">
          Pin dropped · {activePin.lat.toFixed(4)}, {activePin.lng.toFixed(4)}
        </div>
      )}
    </div>
  )
}
