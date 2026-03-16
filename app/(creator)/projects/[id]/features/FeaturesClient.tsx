'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, Trash2, Pencil } from 'lucide-react'
import { useMap } from '@/hooks/useMap'
import { DrawFeatureModal } from '@/components/map/DrawFeatureModal'
import type { Feature, FeatureGeoJSON, FeatureType } from '@/lib/types'

type Props = {
  projectId: string
  initialFeatures: Feature[]
  mapboxToken: string
  center: [number, number]
}

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  path: 'Path / Street',
  park: 'Park / Green Space',
  plaza: 'Plaza / Square',
  landmark: 'Landmark',
  other: 'Other',
}

const FEATURE_TYPES = Object.entries(FEATURE_TYPE_LABELS) as [FeatureType, string][]

export function FeaturesClient({ projectId, initialFeatures, mapboxToken, center }: Props) {
  const [features, setFeatures] = useState<Feature[]>(initialFeatures)
  const [pendingGeoJSON, setPendingGeoJSON] = useState<FeatureGeoJSON | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingGeometry, setEditingGeometry] = useState<FeatureGeoJSON | null>(null)

  // Imperative map handles
  const addFeatureLayerRef = useRef<((f: Feature) => void) | null>(null)
  const removeFeatureLayerRef = useRef<((id: string) => void) | null>(null)
  const cancelDrawRef = useRef<(() => void) | null>(null)
  const startEditGeometryRef = useRef<((f: Feature) => void) | null>(null)
  const stopEditGeometryRef = useRef<((id: string) => void) | null>(null)

  // Keep a stable ref to selectedFeature so the draw-delete callback can access it
  const selectedFeatureRef = useRef<Feature | null>(null)
  useEffect(() => { selectedFeatureRef.current = selectedFeature }, [selectedFeature])

  // ── Draw handlers ──────────────────────────────────────────────────────────

  const handleFeatureDraw = useCallback((geojson: FeatureGeoJSON) => {
    setPendingGeoJSON(geojson)
  }, [])

  const handleDrawSave = useCallback((feature: Feature) => {
    console.log('[FeaturesClient] handleDrawSave', feature.id, 'cancelDrawRef:', !!cancelDrawRef.current, 'addLayerRef:', !!addFeatureLayerRef.current)
    cancelDrawRef.current?.()           // clear draw state so MapboxDraw won't intercept clicks
    setFeatures((prev) => [...prev, feature])
    addFeatureLayerRef.current?.(feature)
    setPendingGeoJSON(null)
  }, [])

  const handleDrawCancel = useCallback(() => {
    cancelDrawRef.current?.()
    setPendingGeoJSON(null)
  }, [])

  // ── Feature click (from map or list) ──────────────────────────────────────

  const handleFeatureClick = useCallback((feature: Feature) => {
    console.log('[FeaturesClient] handleFeatureClick called', feature.id, feature.name)
    setSelectedFeature(feature)
    setIsEditing(false)
    setEditingGeometry(null)
  }, [])

  // ── Draw delete (trash toolbar button) ───────────────────────────────────

  const handleDrawDelete = useCallback(() => {
    const current = selectedFeatureRef.current
    if (current) {
      handleDelete(current.id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit ──────────────────────────────────────────────────────────────────

  const handleEditStart = useCallback((feature: Feature) => {
    setIsEditing(true)
    setEditingGeometry(null)
    startEditGeometryRef.current?.(feature)
  }, [])

  const handleEditCancel = useCallback((featureId: string) => {
    stopEditGeometryRef.current?.(featureId)
    setIsEditing(false)
    setEditingGeometry(null)
  }, [])

  async function handleEditSave(
    featureId: string,
    updates: { name: string; type: FeatureType; description: string }
  ) {
    const body: Record<string, unknown> = { ...updates }
    if (editingGeometry) body.geojson = editingGeometry

    stopEditGeometryRef.current?.(featureId)

    const res = await fetch(`/api/features?id=${featureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return

    const updated = await res.json() as Feature

    setFeatures((prev) => prev.map((f) => (f.id === featureId ? updated : f)))

    // Refresh the map layer with updated geometry if it changed
    if (editingGeometry) {
      removeFeatureLayerRef.current?.(featureId)
      // Small delay to let removeSource settle before re-adding
      setTimeout(() => addFeatureLayerRef.current?.(updated), 50)
    }

    setSelectedFeature(updated)
    setIsEditing(false)
    setEditingGeometry(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(featureId: string) {
    const res = await fetch(`/api/features?id=${featureId}`, { method: 'DELETE' })
    if (!res.ok) return
    setFeatures((prev) => prev.filter((f) => f.id !== featureId))
    removeFeatureLayerRef.current?.(featureId)
    if (selectedFeatureRef.current?.id === featureId) {
      setSelectedFeature(null)
      setIsEditing(false)
      setEditingGeometry(null)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 h-full">
      {/* Map panel */}
      <div className="relative w-[60%] shrink-0 border-r border-border">
        <MapPanel
          mapboxToken={mapboxToken}
          center={center}
          features={features}
          selectedFeatureId={selectedFeature?.id ?? null}
          onFeatureClick={handleFeatureClick}
          onFeatureDraw={handleFeatureDraw}
          onGeometryUpdate={setEditingGeometry}
          onDrawDelete={handleDrawDelete}
          onAddFeatureLayerReady={(fn) => { addFeatureLayerRef.current = fn }}
          onRemoveFeatureLayerReady={(fn) => { removeFeatureLayerRef.current = fn }}
          onCancelDrawReady={(fn) => { cancelDrawRef.current = fn }}
          onStartEditGeometryReady={(fn) => { startEditGeometryRef.current = fn }}
          onStopEditGeometryReady={(fn) => { stopEditGeometryRef.current = fn }}
        />
        <DrawFeatureModal
          open={pendingGeoJSON !== null}
          projectId={projectId}
          geojson={pendingGeoJSON}
          onSave={handleDrawSave}
          onCancel={handleDrawCancel}
        />
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {selectedFeature ? (
          isEditing ? (
            <EditPanel
              feature={selectedFeature}
              hasGeometryChanges={editingGeometry !== null}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          ) : (
            <DetailPanel
              feature={selectedFeature}
              onBack={() => setSelectedFeature(null)}
              onEdit={handleEditStart}
              onDelete={handleDelete}
            />
          )
        ) : (
          <FeatureList features={features} onSelect={handleFeatureClick} />
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FeatureList({ features, onSelect }: { features: Feature[]; onSelect: (f: Feature) => void }) {
  return (
    <>
      <div>
        <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-0.5">
          Map Features
        </h2>
        <p className="text-xs text-muted-foreground">
          Draw new features with the map tools. Click a feature to view or edit.
        </p>
      </div>

      {features.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">🗺️</div>
          <h3 className="font-heading text-base font-semibold text-talwa-navy mb-1">No features yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Use the polygon, line, or point tools on the map to define geographic areas.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {features.map((feature) => (
            <button
              key={feature.id}
              onClick={() => onSelect(feature)}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-white hover:border-talwa-teal/50 hover:bg-talwa-sky/10 transition-colors text-left w-full"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-talwa-navy truncate">{feature.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {FEATURE_TYPE_LABELS[feature.type] ?? feature.type}
                  {feature.description ? ` · ${feature.description}` : ''}
                </p>
              </div>
              <span className="text-xs bg-talwa-sky/50 text-talwa-navy px-2 py-1 rounded-full capitalize shrink-0">
                {(feature as Feature & { source?: string }).source === 'contributor' ? 'contributor' : feature.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function DetailPanel({
  feature,
  onBack,
  onEdit,
  onDelete,
}: {
  feature: Feature
  onBack: () => void
  onEdit: (f: Feature) => void
  onDelete: (id: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirmDelete() {
    setDeleting(true)
    await onDelete(feature.id)
    setDeleting(false)
    setConfirming(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-talwa-navy transition-colors w-fit"
      >
        <ChevronLeft className="w-4 h-4" />
        All features
      </button>

      <div>
        <h2 className="font-heading text-xl font-semibold text-talwa-navy">{feature.name}</h2>
        <span className="inline-block mt-1 text-xs bg-talwa-sky/50 text-talwa-navy px-2 py-1 rounded-full capitalize">
          {FEATURE_TYPE_LABELS[feature.type] ?? feature.type}
        </span>
      </div>

      {feature.description && (
        <p className="text-sm text-talwa-navy/80 leading-relaxed">{feature.description}</p>
      )}

      {(feature as Feature & { source?: string }).source && (
        <p className="text-xs text-muted-foreground">
          Added by: <span className="capitalize">{(feature as Feature & { source?: string }).source}</span>
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onEdit(feature)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-talwa-teal text-white text-sm font-medium hover:bg-talwa-teal/90 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>

        {confirming ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-talwa-burnt-orange">Delete this feature?</span>
            <button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-full bg-talwa-burnt-orange text-white text-sm font-medium hover:bg-talwa-burnt-orange/90 transition-colors disabled:opacity-40"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-full border border-border text-talwa-navy text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-talwa-navy text-sm font-medium hover:border-talwa-burnt-orange hover:text-talwa-burnt-orange transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

function EditPanel({
  feature,
  hasGeometryChanges,
  onSave,
  onCancel,
}: {
  feature: Feature
  hasGeometryChanges: boolean
  onSave: (id: string, updates: { name: string; type: FeatureType; description: string }) => Promise<void>
  onCancel: (featureId: string) => void
}) {
  const [name, setName] = useState(feature.name)
  const [type, setType] = useState<FeatureType>(feature.type)
  const [description, setDescription] = useState(feature.description ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave(feature.id, { name: name.trim(), type, description: description.trim() })
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => onCancel(feature.id)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-talwa-navy transition-colors w-fit"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <div>
        <h2 className="font-heading text-lg font-semibold text-talwa-navy">Edit feature</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reshape the geometry on the map, or update the details below.
        </p>
      </div>

      {hasGeometryChanges && (
        <div className="rounded-lg bg-talwa-olive-light/30 border border-talwa-olive/30 px-3 py-2 text-xs text-talwa-navy">
          Geometry updated — save to apply changes.
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-talwa-navy" htmlFor="edit-name">
            Name <span className="text-talwa-burnt-orange">*</span>
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy focus:outline-none focus:ring-2 focus:ring-talwa-teal/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-talwa-navy" htmlFor="edit-type">Type</label>
          <select
            id="edit-type"
            value={type}
            onChange={(e) => setType(e.target.value as FeatureType)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy focus:outline-none focus:ring-2 focus:ring-talwa-teal/40"
          >
            {FEATURE_TYPES.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-talwa-navy" htmlFor="edit-desc">
            Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </label>
          <textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy resize-none focus:outline-none focus:ring-2 focus:ring-talwa-teal/40"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onCancel(feature.id)}
          className="flex-1 rounded-full border border-border text-talwa-navy text-sm font-medium py-2 hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 rounded-full bg-talwa-teal text-white text-sm font-medium py-2 hover:bg-talwa-teal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ── Map panel ─────────────────────────────────────────────────────────────────

function MapPanel({
  mapboxToken,
  center,
  features,
  selectedFeatureId,
  onFeatureClick,
  onFeatureDraw,
  onGeometryUpdate,
  onDrawDelete,
  onAddFeatureLayerReady,
  onRemoveFeatureLayerReady,
  onCancelDrawReady,
  onStartEditGeometryReady,
  onStopEditGeometryReady,
}: {
  mapboxToken: string
  center: [number, number]
  features: Feature[]
  selectedFeatureId: string | null
  onFeatureClick: (feature: Feature) => void
  onFeatureDraw: (geojson: FeatureGeoJSON) => void
  onGeometryUpdate: (geojson: FeatureGeoJSON) => void
  onDrawDelete: () => void
  onAddFeatureLayerReady: (fn: (f: Feature) => void) => void
  onRemoveFeatureLayerReady: (fn: (id: string) => void) => void
  onCancelDrawReady: (fn: () => void) => void
  onStartEditGeometryReady: (fn: (f: Feature) => void) => void
  onStopEditGeometryReady: (fn: (id: string) => void) => void
}) {
  const {
    mapContainerRef,
    addFeatureLayer,
    removeFeatureLayer,
    cancelDraw,
    startEditGeometry,
    stopEditGeometry,
  } = useMap({
    mapboxToken,
    center,
    features,
    drawingEnabled: true,
    onFeatureClick,
    onFeatureDraw,
    onGeometryUpdate,
    onDrawDelete,
  })

  useEffect(() => { onAddFeatureLayerReady(addFeatureLayer) }, [addFeatureLayer, onAddFeatureLayerReady])
  useEffect(() => { onRemoveFeatureLayerReady(removeFeatureLayer) }, [removeFeatureLayer, onRemoveFeatureLayerReady])
  useEffect(() => { onCancelDrawReady(cancelDraw) }, [cancelDraw, onCancelDrawReady])
  useEffect(() => { onStartEditGeometryReady(startEditGeometry) }, [startEditGeometry, onStartEditGeometryReady])
  useEffect(() => { onStopEditGeometryReady(stopEditGeometry) }, [stopEditGeometry, onStopEditGeometryReady])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      {selectedFeatureId && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-talwa-navy shadow-sm border border-talwa-sky">
          Feature selected
        </div>
      )}
    </div>
  )
}
