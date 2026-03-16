'use client'

import { useEffect, useImperativeHandle, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useMap } from '@/hooks/useMap'
import type { Feature, FeatureGeoJSON, Location } from '@/lib/types'

export type ContributorMapHandle = {
  addFeatureLayer: (feature: Feature) => void
  removeFeatureLayer: (featureId: string) => void
  cancelDraw: () => void
}

type ContributorMapProps = {
  mapboxToken: string
  center: [number, number]
  zoom?: number
  features: Feature[]
  activePin: Location | null
  drawingEnabled?: boolean
  className?: string
  onFeatureClick?: (feature: Feature) => void
  onMapClick?: (location: Location) => void
  onFeatureDraw?: (geojson: FeatureGeoJSON) => void
}

export const ContributorMap = forwardRef<ContributorMapHandle, ContributorMapProps>(
  function ContributorMap(
    {
      mapboxToken,
      center,
      zoom,
      features,
      activePin,
      drawingEnabled = false,
      className,
      onFeatureClick,
      onMapClick,
      onFeatureDraw,
    },
    ref
  ) {
    const { mapContainerRef, addPin, removePin, addFeatureLayer, removeFeatureLayer, cancelDraw } = useMap({
      mapboxToken,
      center,
      zoom,
      features,
      drawingEnabled,
      onFeatureClick,
      onMapClick,
      onFeatureDraw,
    })

    // Expose imperative methods to parent via ref
    useImperativeHandle(ref, () => ({ addFeatureLayer, removeFeatureLayer, cancelDraw }), [
      addFeatureLayer,
      removeFeatureLayer,
      cancelDraw,
    ])

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
)
