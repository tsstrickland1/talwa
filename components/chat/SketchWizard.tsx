'use client'

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sparkles,
  Upload,
  Camera,
  ImageIcon,
  Loader2,
  RotateCcw,
  CheckCircle,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, storagePaths, getFileExtension } from '@/lib/supabase/storage'
import type { Feature, Sketch } from '@/lib/types'

type WizardStep = 'reference' | 'prompt' | 'generating' | 'review'

interface SketchWizardProps {
  feature: Feature
  projectId: string
  conversationId: string
  onClose: () => void
  onPublished: (sketch: Sketch) => void
}

export function SketchWizard({
  feature,
  projectId,
  conversationId,
  onClose,
  onPublished,
}: SketchWizardProps) {
  const [step, setStep] = useState<WizardStep>('reference')
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [referenceLabel, setReferenceLabel] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(
    `A design concept sketch for ${feature.name}, a ${feature.type} in ${feature.description ?? ''}.`.replace(/\.\s*\.$/, '.').trim()
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

  // Fetch existing community sketches for this feature
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
      setGenerateError('Something went wrong generating the sketch. Please try again.')
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
    // Use the generated image as the new reference for the next iteration
    if (generatedImageUrl) {
      setReferenceImageUrl(generatedImageUrl)
      setReferenceLabel('Previous generation')
    }
    setGeneratedImageUrl(null)
    setStep('prompt')
  }, [generatedImageUrl])

  // ─── Step: Reference image ──────────────────────────────────────────────────
  const renderReference = () => (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Choose a reference image to guide the style of your sketch, or skip to describe it
        from scratch.
      </p>

      {/* Upload / camera */}
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
          {uploadingRef ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
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

      {/* Selected reference preview */}
      {referenceImageUrl && (
        <div className="relative rounded-lg overflow-hidden border border-talwa-teal/30 bg-muted">
          <div className="relative aspect-video w-full">
            <Image
              src={referenceImageUrl}
              alt="Reference image"
              fill
              className="object-cover"
              sizes="480px"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 bg-talwa-sky/30">
            <span className="text-xs text-muted-foreground truncate">{referenceLabel}</span>
            <button
              onClick={clearReference}
              className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
              aria-label="Remove reference"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Community sketch picker */}
      {!loadingSketches && existingSketches.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Or pick a community sketch
          </Label>
          <ScrollArea className="h-44">
            <div className="grid grid-cols-3 gap-2 pr-2">
              {existingSketches.map((sketch) => (
                <button
                  key={sketch.id}
                  onClick={() => selectSketchAsReference(sketch)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors hover:border-talwa-teal ${
                    referenceImageUrl === sketch.image
                      ? 'border-talwa-teal'
                      : 'border-transparent'
                  }`}
                  aria-label={sketch.caption || 'Community sketch'}
                >
                  <Image
                    src={sketch.image}
                    alt={sketch.caption || 'Community sketch'}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
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
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )

  // ─── Step: Prompt ───────────────────────────────────────────────────────────
  const renderPrompt = () => (
    <div className="flex flex-col gap-4">
      {referenceImageUrl && (
        <div className="flex items-center gap-2 rounded-lg bg-talwa-sky/30 border border-talwa-teal/20 px-3 py-2">
          <div className="relative w-10 h-10 rounded overflow-hidden shrink-0">
            <Image
              src={referenceImageUrl}
              alt="Reference"
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-talwa-teal font-medium">Reference image selected</p>
            <p className="text-xs text-muted-foreground truncate">{referenceLabel}</p>
          </div>
          <button
            onClick={clearReference}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Remove reference"
          >
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

      {generateError && (
        <p className="text-sm text-destructive">{generateError}</p>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1 bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-2"
          onClick={handleGenerate}
          disabled={!prompt.trim()}
        >
          <Sparkles className="w-4 h-4" />
          Generate sketch
        </Button>
        <Button variant="outline" onClick={() => setStep('reference')}>
          Back
        </Button>
      </div>
    </div>
  )

  // ─── Step: Generating ───────────────────────────────────────────────────────
  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="w-14 h-14 rounded-full bg-talwa-sky/40 flex items-center justify-center">
        <Sparkles className="w-7 h-7 text-talwa-teal animate-pulse" />
      </div>
      <div>
        <p className="font-medium text-talwa-navy">Generating your sketch…</p>
        <p className="text-sm text-muted-foreground mt-1">This usually takes 10–20 seconds.</p>
      </div>
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  // ─── Step: Review ───────────────────────────────────────────────────────────
  const renderReview = () => (
    <div className="flex flex-col gap-4">
      {generatedImageUrl && (
        <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-talwa-teal/20">
          <Image
            src={generatedImageUrl}
            alt="Generated sketch"
            fill
            className="object-cover"
            sizes="480px"
          />
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

      {publishError && (
        <p className="text-sm text-destructive">{publishError}</p>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <Button
          className="w-full bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-2"
          onClick={handlePublish}
          disabled={publishing}
        >
          {publishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          {publishing ? 'Publishing…' : 'Publish to community'}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleTryAgain}
            disabled={publishing}
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            disabled={publishing}
          >
            Discard
          </Button>
        </div>
      </div>
    </div>
  )

  const stepTitles: Record<WizardStep, string> = {
    reference: `Visualize — ${feature.name}`,
    prompt: 'Describe your vision',
    generating: 'Generating sketch',
    review: 'Review your sketch',
  }

  const stepIcons: Record<WizardStep, ReactNode> = {
    reference: <ImageIcon className="w-4 h-4 text-talwa-teal" />,
    prompt: <Sparkles className="w-4 h-4 text-talwa-teal" />,
    generating: <Loader2 className="w-4 h-4 text-talwa-teal animate-spin" />,
    review: <Camera className="w-4 h-4 text-talwa-teal" />,
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {stepIcons[step]}
            {stepTitles[step]}
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex gap-1 mt-2">
            {(['reference', 'prompt', 'review'] as const).map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  step === 'generating'
                    ? i < 2
                      ? 'bg-talwa-teal'
                      : 'bg-muted'
                    : i < (['reference', 'prompt', 'review'] as const).indexOf(step) + 1
                    ? 'bg-talwa-teal'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-5 py-5">
            {step === 'reference' && renderReference()}
            {step === 'prompt' && renderPrompt()}
            {step === 'generating' && renderGenerating()}
            {step === 'review' && renderReview()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
