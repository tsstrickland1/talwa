'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Feature, FeatureGeoJSON, FeatureType } from '@/lib/types'

type Props = {
  open: boolean
  projectId: string
  geojson: FeatureGeoJSON | null
  onSave: (feature: Feature) => void
  onCancel: () => void
}

const FEATURE_TYPES: { value: FeatureType; label: string }[] = [
  { value: 'path', label: 'Path / Street' },
  { value: 'park', label: 'Park / Green Space' },
  { value: 'plaza', label: 'Plaza / Square' },
  { value: 'landmark', label: 'Landmark' },
  { value: 'other', label: 'Other' },
]

export function DrawFeatureModal({ open, projectId, geojson, onSave, onCancel }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<FeatureType>('other')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim() || !geojson) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          name: name.trim(),
          type,
          description: description.trim(),
          geojson,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        setError(text || 'Failed to save feature')
        return
      }

      const feature = await res.json() as Feature
      // Reset form
      setName('')
      setType('other')
      setDescription('')
      onSave(feature)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setName('')
    setType('other')
    setDescription('')
    setError(null)
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-talwa-navy">
            Name this area
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-talwa-navy" htmlFor="feature-name">
              Name <span className="text-talwa-burnt-orange">*</span>
            </label>
            <input
              id="feature-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Street Corridor"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-talwa-teal/40"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-talwa-navy" htmlFor="feature-type">
              Type
            </label>
            <select
              id="feature-type"
              value={type}
              onChange={(e) => setType(e.target.value as FeatureType)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy focus:outline-none focus:ring-2 focus:ring-talwa-teal/40"
            >
              {FEATURE_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-talwa-navy" htmlFor="feature-desc">
              Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </label>
            <textarea
              id="feature-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe this area…"
              rows={2}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-talwa-teal/40"
            />
          </div>

          {error && (
            <p className="text-xs text-talwa-burnt-orange">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 rounded-full border border-border text-talwa-navy text-sm font-medium py-2 hover:bg-accent transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 rounded-full bg-talwa-teal text-white text-sm font-medium py-2 hover:bg-talwa-teal/90 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save area'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
