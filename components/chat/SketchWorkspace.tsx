'use client'

import { useState, useRef, useCallback, useEffect, type ChangeEvent } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles,
  Upload,
  ImageIcon,
  Loader2,
  RotateCcw,
  CheckCircle,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, storagePaths, getFileExtension } from '@/lib/supabase/storage'
import type { Feature, Sketch } from '@/lib/types'

type WorkspaceStep = 'reference' | 'prompt' | 'generating' | 'review'

interface SketchWorkspaceProps {
  feature: Feature
  projectId: string
  conversationId: string
  onClose: () => void
  onPublished: (sketch: Sketch) => void
}

const STEP_ORDER: WorkspaceStep[] = ['reference', 'prompt', 'review']

function stepIndex(step: WorkspaceStep): number {
  const s = step === 'generating' ? 'review' : step
  return STEP_ORDER.indexOf(s)
}

export function SketchWorkspace({
  feature,
  projectId,
  conversationId,
  onClose,
  onPublished,
}: SketchWorkspaceProps) {
  const [step, setStep] = useState<WorkspaceStep>('reference')
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [referenceLabel, setReferenceLabel] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(
    `A design concept sketch for ${feature.name}, a ${feature.type}${feature.description ? `. ${feature.description}` : ''}.`
      .replace(/\.\.$/, '.')
      .trim()
  )
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [existingSketches, setExistingSketches] = useState<Sketch[]>([])
  const [loadingSketches, setLoadingSketches] = useState(true)
  const [uploadingRef, setUploadingRef] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('sketches')
      .select('*')
      .eq('feature_id', feature.id)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }: { data: Sketch[] | null }) => {
        setExistingSketches(data ?? [])
        setLoadingSketches(false)
      })
  }, [feature.id])

  const handleFileSelected = useCallback(
    async (file: File) => {
      setUploadingRef(true)
      try {
        const supabase = createClient()
        const ext = getFileExtension(file)
        const path = storagePaths.conversationAttachment(conversationId, ext)
        const url = await uploadImage(supabase, 'conversation-attachments', path, file)
        setReferenceImageUrl(url)
        setReferenceLabel(file.name)
      } catch {
        // silent — user can retry
      } finally {
        setUploadingRef(false)
      }
    },
    [conversationId]
  )

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelected(file)
      e.target.value = ''
    },
    [handleFileSelected]
  )

  const selectSketchAsReference = useCallback((sketch: Sketch) => {
    setReferenceImageUrl(sketch.image)
    setReferenceLabel('Community sketch')
  }, [])

  const clearReference = useCallback(() => {
    setReferenceImageUrl(null)
    setReferenceLabel(null)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setStep('generating')
    setGenerateError(null)
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          feature_id: feature.id,
          project_id: projectId,
          ...(referenceImageUrl ? { reference_image_url: referenceImageUrl } : {}),
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { image_url } = (await res.json()) as { image_url: string }
      setGeneratedImageUrl(image_url)
      setStep('review')
    } catch {
      setGenerateError('Something went wrong. Please try again.')
      setStep('prompt')
    }
  }, [prompt, feature.id, projectId, referenceImageUrl])

  const handlePublish = useCallback(async () => {
    if (!generatedImageUrl) return
    setPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch('/api/images/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: generatedImageUrl,
          feature_id: feature.id,
          project_id: projectId,
          caption: caption.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Publish failed')
      const { sketch } = (await res.json()) as { sketch: Sketch }
      onPublished(sketch)
      onClose()
    } catch {
      setPublishError('Failed to publish. Please try again.')
    } finally {
      setPublishing(false)
    }
  }, [generatedImageUrl, feature.id, projectId, caption, onPublished, onClose])

  const handleTryAgain = useCallback(() => {
    if (generatedImageUrl) {
      setReferenceImageUrl(generatedImageUrl)
      setReferenceLabel('Previous generation')
    }
    setGeneratedImageUrl(null)
    setStep('prompt')
  }, [generatedImageUrl])

  // ─── Header ──────────────────────────────────────────────────────────────────

  const stepTitle: Record<WorkspaceStep, string> = {
    reference: `Visualize — ${feature.name}`,
    prompt: 'Describe your vision',
    generating: 'Generating…',
    review: 'Review your sketch',
  }

  // ─── Step: Reference ─────────────────────────────────────────────────────────

  const renderReference = () => (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Add a reference photo of the current space, or pick an existing community sketch — or
        skip straight to describing your vision.
      </p>

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadingRef}
      >
        {uploadingRef ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploadingRef ? 'Uploading…' : 'Upload / take photo'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {referenceImageUrl && (
        <div className="rounded-lg overflow-hidden border border-talwa-teal/30">
          <div className="relative aspect-video w-full bg-muted">
            <Image src={referenceImageUrl} alt="Reference" fill className="object-cover" sizes="400px" />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 bg-talwa-sky/20">
            <span className="text-xs text-muted-foreground truncate">{referenceLabel}</span>
            <button onClick={clearReference} aria-label="Remove reference" className="text-muted-foreground hover:text-foreground ml-2 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {loadingSketches && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading community sketches…</span>
        </div>
      )}

      {!loadingSketches && existingSketches.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Community sketches
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {existingSketches.map((sketch) => (
              <button
                key={sketch.id}
                onClick={() => selectSketchAsReference(sketch)}
                aria-label={sketch.caption || 'Community sketch'}
                className={`relative aspect-square rounded overflow-hidden border-2 transition-colors hover:border-talwa-teal ${
                  referenceImageUrl === sketch.image ? 'border-talwa-teal' : 'border-transparent'
                }`}
              >
                <Image src={sketch.image} alt={sketch.caption || 'Community sketch'} fill className="object-cover" sizes="100px" />
                {referenceImageUrl === sketch.image && (
                  <div className="absolute inset-0 flex items-center justify-center bg-talwa-teal/20">
                    <CheckCircle className="w-4 h-4 text-talwa-teal" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1 bg-talwa-teal hover:bg-talwa-teal/90 text-white"
          size="sm"
          onClick={() => setStep('prompt')}
        >
          {referenceImageUrl ? 'Use this reference' : 'Skip — no reference'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )

  // ─── Step: Prompt ─────────────────────────────────────────────────────────────

  const renderPrompt = () => (
    <div className="flex flex-col gap-3">
      {referenceImageUrl && (
        <div className="flex items-center gap-2 rounded-lg bg-talwa-sky/30 border border-talwa-teal/20 px-3 py-2">
          <div className="relative w-9 h-9 rounded overflow-hidden shrink-0">
            <Image src={referenceImageUrl} alt="Reference" fill className="object-cover" sizes="36px" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-talwa-teal font-medium leading-tight">Reference selected</p>
            <p className="text-xs text-muted-foreground truncate">{referenceLabel}</p>
          </div>
          <button onClick={clearReference} aria-label="Remove reference" className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="sketch-prompt" className="text-xs">Describe your vision</Label>
        <Textarea
          id="sketch-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you'd like to see…"
          rows={4}
          className="resize-none text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Mention materials, atmosphere, time of day, or design style.
        </p>
      </div>

      {generateError && <p className="text-xs text-destructive">{generateError}</p>}

      <div className="flex gap-2">
        <Button
          className="flex-1 bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-1.5"
          size="sm"
          onClick={handleGenerate}
          disabled={!prompt.trim()}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStep('reference')}>
          Back
        </Button>
      </div>
    </div>
  )

  // ─── Step: Generating ─────────────────────────────────────────────────────────

  const renderGenerating = () => (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-talwa-sky/40 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-talwa-teal animate-pulse" />
      </div>
      <div>
        <p className="text-sm font-medium text-talwa-navy">Generating your sketch…</p>
        <p className="text-xs text-muted-foreground mt-0.5">This usually takes 10–20 seconds.</p>
      </div>
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  )

  // ─── Step: Review ─────────────────────────────────────────────────────────────

  const renderReview = () => (
    <div className="flex flex-col gap-3">
      {generatedImageUrl && (
        <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-talwa-teal/20">
          <Image src={generatedImageUrl} alt="Generated sketch" fill className="object-cover" sizes="400px" />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="sketch-caption" className="text-xs">Caption (optional)</Label>
        <Input
          id="sketch-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption for the community…"
          maxLength={500}
          className="text-sm"
        />
      </div>

      {publishError && <p className="text-xs text-destructive">{publishError}</p>}

      <Button
        className="w-full bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-1.5"
        size="sm"
        onClick={handlePublish}
        disabled={publishing}
      >
        {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
        {publishing ? 'Publishing…' : 'Publish to community'}
      </Button>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleTryAgain} disabled={publishing}>
          <RotateCcw className="w-3.5 h-3.5" />
          Try again
        </Button>
        <Button variant="ghost" size="sm" className="flex-1" onClick={onClose} disabled={publishing}>
          Discard
        </Button>
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-talwa-teal/20 bg-talwa-sky/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-talwa-teal/10">
        <ImageIcon className="w-3.5 h-3.5 text-talwa-teal shrink-0" />
        <span className="flex-1 text-xs font-medium text-talwa-teal truncate">
          {stepTitle[step]}
        </span>

        {/* Step indicator pills */}
        <div className="flex gap-1 shrink-0">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`h-1 w-5 rounded-full transition-colors ${
                i <= stepIndex(step) ? 'bg-talwa-teal' : 'bg-talwa-teal/20'
              }`}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {step === 'reference' && renderReference()}
        {step === 'prompt' && renderPrompt()}
        {step === 'generating' && renderGenerating()}
        {step === 'review' && renderReview()}
      </div>
    </div>
  )
}
