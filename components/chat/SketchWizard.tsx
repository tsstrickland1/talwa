'use client'

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sparkles,
  Upload,
  ImageIcon,
  Loader2,
  RotateCcw,
  CheckCircle,
  X,
  MapPin,
  PenLine,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, storagePaths, getFileExtension } from '@/lib/supabase/storage'
import type { Feature, Sketch } from '@/lib/types'

type WorkspaceStep = 'feature_select' | 'reference' | 'prompt' | 'generating' | 'review'

interface SketchWorkspaceProps {
  activeFeature: Feature | null
  projectId: string
  conversationId: string
  onClose: () => void
  onPublished: (sketch: Sketch) => void
  onGoToMap: () => void
  onDrawNewFeature: () => void
}

export function SketchWorkspace({
  activeFeature,
  projectId,
  conversationId,
  onClose,
  onPublished,
  onGoToMap,
  onDrawNewFeature,
}: SketchWorkspaceProps) {
  const [step, setStep] = useState<WorkspaceStep>('feature_select')
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [prompt, setPrompt] = useState('')
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [referenceLabel, setReferenceLabel] = useState<string | null>(null)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [existingSketches, setExistingSketches] = useState<Sketch[]>([])
  const [loadingSketches, setLoadingSketches] = useState(false)
  const [uploadingRef, setUploadingRef] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch community sketches whenever a feature is confirmed for the workspace
  useEffect(() => {
    if (!selectedFeature) return
    setLoadingSketches(true)
    const supabase = createClient()
    supabase
      .from('sketches')
      .select('*')
      .eq('feature_id', selectedFeature.id)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }: { data: Sketch[] | null }) => {
        setExistingSketches(data ?? [])
        setLoadingSketches(false)
      })
  }, [selectedFeature?.id])

  const handleContinueFromFeatureSelect = useCallback(() => {
    if (!activeFeature) return
    setSelectedFeature(activeFeature)
    const desc = activeFeature.description?.trim() ?? ''
    const base = `A design concept sketch for ${activeFeature.name}, a ${activeFeature.type}`
    setPrompt(desc ? `${base}. ${desc}.` : `${base}.`)
    setStep('reference')
  }, [activeFeature])

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
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!prompt.trim() || !selectedFeature) return
    setStep('generating')
    setGenerateError(null)
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          feature_id: selectedFeature.id,
          project_id: projectId,
          ...(referenceImageUrl ? { reference_image_url: referenceImageUrl } : {}),
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { image_url } = (await res.json()) as { image_url: string }
      setGeneratedImageUrl(image_url)
      setStep('review')
    } catch {
      setGenerateError('Something went wrong generating the sketch. Please try again.')
      setStep('prompt')
    }
  }, [prompt, selectedFeature, projectId, referenceImageUrl])

  const handlePublish = useCallback(async () => {
    if (!generatedImageUrl || !selectedFeature) return
    setPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch('/api/images/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: generatedImageUrl,
          feature_id: selectedFeature.id,
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
  }, [generatedImageUrl, selectedFeature, projectId, caption, onPublished, onClose])

  const handleTryAgain = useCallback(() => {
    if (generatedImageUrl) {
      setReferenceImageUrl(generatedImageUrl)
      setReferenceLabel('Previous generation')
    }
    setGeneratedImageUrl(null)
    setStep('prompt')
  }, [generatedImageUrl])

  // ─── Step: Feature select ───────────────────────────────────────────────────
  const renderFeatureSelect = () => (
    <div className="flex flex-col gap-4 py-1">
      {activeFeature ? (
        <>
          <div className="flex items-start gap-3 rounded-lg bg-talwa-teal/5 border border-talwa-teal/20 px-3 py-3">
            <MapPin className="w-4 h-4 text-talwa-teal shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-talwa-navy truncate">{activeFeature.name}</p>
              {activeFeature.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {activeFeature.description}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tap another feature on the map to change the selection.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-2"
              onClick={handleContinueFromFeatureSelect}
            >
              Continue with this feature
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={onDrawNewFeature}
            >
              <PenLine className="w-4 h-4" />
              Draw a different feature
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tap a feature on the map to choose where to generate a design sketch.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-2 md:hidden"
              onClick={onGoToMap}
            >
              <MapPin className="w-4 h-4" />
              Go to map
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={onDrawNewFeature}
            >
              <PenLine className="w-4 h-4" />
              Draw a new feature
            </Button>
          </div>
        </>
      )}
    </div>
  )

  // ─── Step: Reference image ──────────────────────────────────────────────────
  const renderReference = () => (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Choose a reference image to guide the style, or skip to describe from scratch.
      </p>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Upload a photo
        </Label>
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
      </div>

      {referenceImageUrl && (
        <div className="rounded-lg overflow-hidden border border-talwa-teal/30 bg-muted">
          <div className="relative aspect-video w-full">
            <Image src={referenceImageUrl} alt="Reference image" fill className="object-cover" sizes="480px" />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 bg-talwa-sky/30">
            <span className="text-xs text-muted-foreground truncate">{referenceLabel}</span>
            <button onClick={clearReference} className="text-muted-foreground hover:text-foreground ml-2 shrink-0" aria-label="Remove reference">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {!loadingSketches && existingSketches.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Or pick a community sketch
          </Label>
          <ScrollArea className="h-36">
            <div className="grid grid-cols-3 gap-2 pr-2">
              {existingSketches.map((sketch) => (
                <button
                  key={sketch.id}
                  onClick={() => selectSketchAsReference(sketch)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors hover:border-talwa-teal ${
                    referenceImageUrl === sketch.image ? 'border-talwa-teal' : 'border-transparent'
                  }`}
                  aria-label={sketch.caption || 'Community sketch'}
                >
                  <Image src={sketch.image} alt={sketch.caption || 'Community sketch'} fill className="object-cover" sizes="120px" />
                  {referenceImageUrl === sketch.image && (
                    <div className="absolute inset-0 flex items-center justify-center bg-talwa-teal/20">
                      <CheckCircle className="w-5 h-5 text-talwa-teal" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {loadingSketches && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Loading community sketches…</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1 bg-talwa-teal hover:bg-talwa-teal/90 text-white"
          onClick={() => setStep('prompt')}
        >
          {referenceImageUrl ? 'Use this reference' : 'Skip — no reference'}
        </Button>
        <Button variant="ghost" onClick={() => setStep('feature_select')}>Back</Button>
      </div>
    </div>
  )

  // ─── Step: Prompt ───────────────────────────────────────────────────────────
  const renderPrompt = () => (
    <div className="flex flex-col gap-4">
      {referenceImageUrl && (
        <div className="flex items-center gap-2 rounded-lg bg-talwa-sky/30 border border-talwa-teal/20 px-3 py-2">
          <div className="relative w-10 h-10 rounded overflow-hidden shrink-0">
            <Image src={referenceImageUrl} alt="Reference" fill className="object-cover" sizes="40px" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-talwa-teal font-medium">Reference image selected</p>
            <p className="text-xs text-muted-foreground truncate">{referenceLabel}</p>
          </div>
          <button onClick={clearReference} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Remove reference">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sketch-prompt">Describe your vision</Label>
        <Textarea
          id="sketch-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you'd like to see in the sketch…"
          rows={5}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Be specific — mention materials, atmosphere, time of day, and design style.
        </p>
      </div>

      {generateError && <p className="text-sm text-destructive">{generateError}</p>}

      <div className="flex gap-2">
        <Button
          className="flex-1 bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-2"
          onClick={handleGenerate}
          disabled={!prompt.trim()}
        >
          <Sparkles className="w-4 h-4" />
          Generate sketch
        </Button>
        <Button variant="outline" onClick={() => setStep('reference')}>Back</Button>
      </div>
    </div>
  )

  // ─── Step: Generating ───────────────────────────────────────────────────────
  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-talwa-sky/40 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-talwa-teal animate-pulse" />
      </div>
      <div>
        <p className="font-medium text-talwa-navy text-sm">Generating your sketch…</p>
        <p className="text-xs text-muted-foreground mt-1">This usually takes 10–20 seconds.</p>
      </div>
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  )

  // ─── Step: Review ───────────────────────────────────────────────────────────
  const renderReview = () => (
    <div className="flex flex-col gap-4">
      {generatedImageUrl && (
        <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-talwa-teal/20">
          <Image src={generatedImageUrl} alt="Generated sketch" fill className="object-cover" sizes="480px" />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sketch-caption">Caption (optional)</Label>
        <Input
          id="sketch-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption for the community…"
          maxLength={500}
        />
      </div>

      {publishError && <p className="text-sm text-destructive">{publishError}</p>}

      <div className="flex flex-col gap-2">
        <Button
          className="w-full bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-2"
          onClick={handlePublish}
          disabled={publishing}
        >
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {publishing ? 'Publishing…' : 'Publish to community'}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleTryAgain} disabled={publishing}>
            <RotateCcw className="w-4 h-4" />
            Try again
          </Button>
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={publishing}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  )

  const stepTitle = ((): string => {
    if (step === 'feature_select') return 'Visualize'
    if (step === 'reference') return selectedFeature ? `Visualize — ${selectedFeature.name}` : 'Choose a reference'
    if (step === 'prompt') return 'Describe your vision'
    if (step === 'generating') return 'Generating sketch'
    return 'Review your sketch'
  })()

  const stepIcon = ((): ReactNode => {
    if (step === 'feature_select') return <Sparkles className="w-3.5 h-3.5" />
    if (step === 'reference') return <ImageIcon className="w-3.5 h-3.5" />
    if (step === 'prompt') return <Sparkles className="w-3.5 h-3.5" />
    if (step === 'generating') return <Loader2 className="w-3.5 h-3.5 animate-spin" />
    return <CheckCircle className="w-3.5 h-3.5" />
  })()

  // Step progress indicator — 4 visible steps (feature_select, reference, prompt, review)
  const PROGRESS_STEPS: WorkspaceStep[] = ['feature_select', 'reference', 'prompt', 'review']
  const progressIndex = step === 'generating' ? 2 : PROGRESS_STEPS.indexOf(step)

  return (
    <div className="mx-2 my-1 rounded-xl border border-talwa-teal/20 bg-talwa-sky/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-talwa-teal/10">
        <div className="flex items-center gap-1.5 text-xs text-talwa-teal font-medium">
          {stepIcon}
          <span>{stepTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Step progress pills */}
          <div className="flex gap-1">
            {PROGRESS_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 w-4 rounded-full transition-colors ${
                  i <= progressIndex ? 'bg-talwa-teal' : 'bg-talwa-teal/20'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-3">
        {step === 'feature_select' && renderFeatureSelect()}
        {step === 'reference' && renderReference()}
        {step === 'prompt' && renderPrompt()}
        {step === 'generating' && renderGenerating()}
        {step === 'review' && renderReview()}
      </div>
    </div>
  )
}
