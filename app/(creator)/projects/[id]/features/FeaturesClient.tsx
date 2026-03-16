'use client'

import { useState, useRef, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { useMap } from '@/hooks/useMap'
import { DrawFeatureModal } from '@/components/map/DrawFeatureModal'
import type { Feature, FeatureGeoJSON } from '@/lib/types'

type Props = {
  projectId: string
  initialFeatures: Feature[]
  mapboxToken: string
  center: [number, number]
}

export function FeaturesClient({ projectId, initialFeatures, mapboxToken, center }: Props) {
  const [features, setFeatures] = useState<Feature[]>(initialFeatures)
  const [pendingGeoJSON, setPendingGeoJSON] = useState<FeatureGeoJSON | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // addFeatureLayerRef lets us call addFeatureLayer after the map has loaded
  const addFeatureLayerRef = useRef<((f: Feature) => void) | null>(null)
  const cancelDrawRef = useRef<(() => void) | null>(null)

  const handleFeatureDraw = useCallback((geojson: FeatureGeoJSON) => {
    setPendingGeoJSON(geojson)
  }, [])

  const handleDrawSave = useCallback((feature: Feature) => {
    setFeatures((prev) => [...prev, feature])
    addFeatureLayerRef.current?.(feature)
    setPendingGeoJSON(null)
  }, [])

  const handleDrawCancel = useCallback(() => {
    cancelDrawRef.current?.()
    setPendingGeoJSON(null)
  }, [])

  async function handleDelete(featureId: string) {
    setDeletingId(featureId)
    try {
      const res = await fetch(`/api/features?id=${featureId}`, { method: 'DELETE' })
      if (res.ok) {
        setFeatures((prev) => prev.filter((f) => f.id !== featureId))
      }
    } finally {
      setDeletingId(null)
    }
  }

  // Inner map component — must be a separate component to use useMap
  // (which itself is SSR-unsafe; this whole file is loaded with ssr:false)
  return (
    <div className="flex flex-1 min-h-0 h-full">
      {/* Map panel */}
      <div className="relative w-[60%] shrink-0 border-r border-border">
        <MapPanel
          mapboxToken={mapboxToken}
          center={center}
          features={features}
          onFeatureDraw={handleFeatureDraw}
          onAddFeatureLayerReady={(fn) => { addFeatureLayerRef.current = fn }}
          onCancelDrawReady={(fn) => { cancelDrawRef.current = fn }}
        />
        <DrawFeatureModal
          open={pendingGeoJSON !== null}
          projectId={projectId}
          geojson={pendingGeoJSON}
          onSave={handleDrawSave}
          onCancel={handleDrawCancel}
        />
      </div>

      {/* Feature list panel */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-0.5">
            Map Features
          </h2>
          <p className="text-xs text-muted-foreground">
            Use the drawing tools on the map to add new features.
          </p>
        </div>

        {features.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 border-2 border-dashed border-border rounded-xl">
            <div className="text-4xl mb-3">🗺️</div>
            <h3 className="font-heading text-base font-semibold text-talwa-navy mb-1">
              No features yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Use the polygon, line, or point tools on the map to define geographic areas for this project.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-white hover:border-talwa-sky transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-talwa-navy truncate">{feature.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {feature.type}{feature.description ? ` · ${feature.description}` : ''}
                  </p>
                </div>
                <span className="text-xs bg-talwa-sky/50 text-talwa-navy px-2 py-1 rounded-full capitalize shrink-0">
                  {feature.source === 'contributor' ? 'contributor' : feature.type}
                </span>
                <button
                  onClick={() => handleDelete(feature.id)}
                  disabled={deletingId === feature.id}
                  className="text-muted-foreground hover:text-talwa-burnt-orange transition-colors disabled:opacity-40 shrink-0"
                  aria-label={`Delete ${feature.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Separate component so useMap can be called cleanly
function MapPanel({
  mapboxToken,
  center,
  features,
  onFeatureDraw,
  onAddFeatureLayerReady,
  onCancelDrawReady,
}: {
  mapboxToken: string
  center: [number, number]
  features: Feature[]
  onFeatureDraw: (geojson: FeatureGeoJSON) => void
  onAddFeatureLayerReady: (fn: (f: Feature) => void) => void
  onCancelDrawReady: (fn: () => void) => void
}) {
  const { mapContainerRef, addFeatureLayer, cancelDraw } = useMap({
    mapboxToken,
    center,
    features,
    drawingEnabled: true,
    onFeatureDraw,
  })

  // Expose imperative methods to parent via callbacks on first render
  // Using a ref to avoid re-registering on every render
  const registeredRef = useRef(false)
  if (!registeredRef.current) {
    registeredRef.current = true
    onAddFeatureLayerReady(addFeatureLayer)
    onCancelDrawReady(cancelDraw)
  }

  return <div ref={mapContainerRef} className="w-full h-full" />
}
