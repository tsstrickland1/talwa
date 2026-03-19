'use client'

import { useEffect, useImperativeHandle, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useMap } from '@/hooks/useMap'
import type { DataPoint, Feature, FeatureGeoJSON, Location } from '@/lib/types'

export type ContributorMapHandle = {
  addFeatureLayer: (feature: Feature) => void
  removeFeatureLayer: (featureId: string) => void
  cancelDraw: () => void
  startEditGeometry: (feature: Feature) => void
  stopEditGeometry: (featureId: string) => void
  flyToFeature: (feature: Feature) => void
}

type ContributorMapProps = {
  mapboxToken: string
  center: [number, number]
  zoom?: number
  features: Feature[]
  activePin: Location | null
  activeFeature?: Feature | null
  drawingEnabled?: boolean
  className?: string
  onFeatureClick?: (feature: Feature) => void
  onMapClick?: (location: Location) => void
  onFeatureDraw?: (geojson: FeatureGeoJSON) => void
  onGeometryUpdate?: (geojson: FeatureGeoJSON) => void
  highlightedDataPoints?: DataPoint[]
  highlightedFeatureIds?: string[]
}

export const ContributorMap = forwardRef<ContributorMapHandle, ContributorMapProps>(
  function ContributorMap(
    {
      mapboxToken,
      center,
      zoom,
      features,
      activePin,
      activeFeature,
      drawingEnabled = false,
      className,
      onFeatureClick,
      onMapClick,
      onFeatureDraw,
      onGeometryUpdate,
      highlightedDataPoints = [],
      highlightedFeatureIds = [],
    },
    ref
  ) {
    const { mapContainerRef, addPin, removePin, filterToDataPoints, highlightFeatures, addFeatureLayer, removeFeatureLayer, cancelDraw, startEditGeometry, stopEditGeometry, flyToFeature } = useMap({
      mapboxToken,
      center,
      zoom,
      features,
      drawingEnabled,
      onFeatureClick,
      onMapClick,
      onFeatureDraw,
      onGeometryUpdate,
    })

    // Expose imperative methods to parent via ref
    useImperativeHandle(ref, () => ({ addFeatureLayer, removeFeatureLayer, cancelDraw, startEditGeometry, stopEditGeometry, flyToFeature }), [
      addFeatureLayer,
      removeFeatureLayer,
      cancelDraw,
      startEditGeometry,
      stopEditGeometry,
      flyToFeature,
    ])

    // Sync pin with activePin state
    useEffect(() => {
      if (activePin) {
        addPin(activePin)
      } else {
        removePin()
      }
    }, [activePin, addPin, removePin])

    // Sync data point markers when a theme is surfaced
    useEffect(() => {
      filterToDataPoints(highlightedDataPoints)
    }, [highlightedDataPoints, filterToDataPoints])

    // Sync feature highlight state
    useEffect(() => {
      highlightFeatures(highlightedFeatureIds)
    }, [highlightedFeatureIds, highlightFeatures])

    return (
      <div className={cn('relative w-full h-full', className)}>
        <div ref={mapContainerRef} className="w-full h-full" />
        {activePin && !activeFeature && (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-talwa-navy shadow-sm border border-talwa-sky">
            Pin dropped · {activePin.lat.toFixed(4)}, {activePin.lng.toFixed(4)}
          </div>
        )}
      </div>
    )
  }
)
