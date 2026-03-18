'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, Trash2, Pencil, Map as MapIcon, List } from 'lucide-react'
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
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')

  // Keep a stable ref to selectedFeature so the draw-delete callback can access it
  const selectedFeatureRef = useRef<Feature | null>(null)
  useEffect(() => { selectedFeatureRef.current = selectedFeature }, [selectedFeature])

  // ── Map ────────────────────────────────────────────────────────────────────

  const handleFeatureClick = useCallback((feature: Feature) => {
    setSelectedFeature(feature)
    setIsEditing(false)
    setEditingGeometry(null)
    setMobileView('map')
  }, [])

  const handleFeatureDraw = useCallback((geojson: FeatureGeoJSON) => {
    setPendingGeoJSON(geojson)
  }, [])

  const handleDrawDelete = useCallback(() => {
    const current = selectedFeatureRef.current
    if (current) handleDeleteById(current.id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    onFeatureClick: handleFeatureClick,
    onFeatureDraw: handleFeatureDraw,
    onGeometryUpdate: setEditingGeometry,
    onDrawDelete: handleDrawDelete,
  })

  // ── Draw handlers ──────────────────────────────────────────────────────────

  const handleDrawSave = useCallback((feature: Feature) => {
    cancelDraw()
    setFeatures((prev) => [...prev, feature])
    addFeatureLayer(feature)
    setPendingGeoJSON(null)
  }, [cancelDraw, addFeatureLayer])

  const handleDrawCancel = useCallback(() => {
    cancelDraw()
    setPendingGeoJSON(null)
  }, [cancelDraw])

  // ── Edit ──────────────────────────────────────────────────────────────────

  const handleEditStart = useCallback((feature: Feature) => {
    setIsEditing(true)
    setEditingGeometry(null)
    startEditGeometry(feature)
  }, [startEditGeometry])

  const handleEditCancel = useCallback((featureId: string) => {
    stopEditGeometry(featureId)
    setIsEditing(false)
    setEditingGeometry(null)
  }, [stopEditGeometry])

  async function handleEditSave(
    featureId: string,
    updates: { name: string; type: FeatureType; description: string }
  ) {
    const body: Record<string, unknown> = { ...updates }
    if (editingGeometry) body.geojson = editingGeometry

    stopEditGeometry(featureId)

    const res = await fetch(`/api/features?id=${featureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return

    const updated = await res.json() as Feature

    setFeatures((prev) => prev.map((f) => (f.id === featureId ? updated : f)))

    if (editingGeometry) {
      removeFeatureLayer(featureId)
      setTimeout(() => addFeatureLayer(updated), 50)
    }

    setSelectedFeature(updated)
    setIsEditing(false)
    setEditingGeometry(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDeleteById(featureId: string) {
    const res = await fetch(`/api/features?id=${featureId}`, { method: 'DELETE' })
    if (!res.ok) return
    setFeatures((prev) => prev.filter((f) => f.id !== featureId))
    removeFeatureLayer(featureId)
    if (selectedFeatureRef.current?.id === featureId) {
      setSelectedFeature(null)
      setIsEditing(false)
      setEditingGeometry(null)
    }
  }

  const mapPanel = (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      {selectedFeature && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-talwa-navy shadow-sm border border-talwa-sky">
          Feature selected
        </div>
      )}
      <DrawFeatureModal
        open={pendingGeoJSON !== null}
        projectId={projectId}
        geojson={pendingGeoJSON}
        onSave={handleDrawSave}
        onCancel={handleDrawCancel}
      />
    </div>
  )

  const listPanel = (
    <div className="overflow-y-auto p-5 flex flex-col gap-4 h-full">
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
            onDelete={handleDeleteById}
          />
        )
      ) : (
        <FeatureList features={features} onSelect={(f) => { handleFeatureClick(f); setMobileView('map') }} />
      )}
    </div>
  )

  return (
    <>
      {/* Mobile: toggle layout (below 768px) */}
      <div className="flex flex-col md:hidden h-[calc(100vh-3.5rem)]">
        {/* Toggle strip */}
        <div className="flex shrink-0 border-b border-border bg-background">
          <button
            onClick={() => setMobileView('map')}
            className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-sm font-medium transition-colors ${
              mobileView === 'map'
                ? 'text-talwa-teal border-b-2 border-talwa-teal'
                : 'text-muted-foreground hover:text-talwa-navy'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            Map
          </button>
          <button
            onClick={() => setMobileView('list')}
            className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-sm font-medium transition-colors ${
              mobileView === 'list'
                ? 'text-talwa-teal border-b-2 border-talwa-teal'
                : 'text-muted-foreground hover:text-talwa-navy'
            }`}
          >
            <List className="h-4 w-4" />
            Features
          </button>
        </div>
        {/* Panel */}
        <div className="flex-1 min-h-0">
          {mobileView === 'map' ? mapPanel : listPanel}
        </div>
      </div>

      {/* Desktop: split layout (768px and above) */}
      <div className="hidden md:flex flex-1 min-h-0 h-full">
        <div className="relative w-[60%] shrink-0 border-r border-border">
          {mapPanel}
        </div>
        <div className="flex-1">
          {listPanel}
        </div>
      </div>
    </>
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
