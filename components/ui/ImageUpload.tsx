'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, type PublicBucket } from '@/lib/supabase/storage'

interface ImageUploadProps {
  /** Target bucket — must be a public bucket */
  bucket: PublicBucket
  /** Pre-computed storage path via storagePaths.* */
  path: string
  /** Existing image URL to display before a new upload */
  currentUrl?: string | null
  /** Called with the new public URL after a successful upload */
  onUpload: (url: string) => void
  /** Visual proportions of the upload area */
  aspectRatio?: 'square' | 'video' | 'wide'
  /** Label shown in the upload area */
  label?: string
  className?: string
}

const aspectClasses: Record<NonNullable<ImageUploadProps['aspectRatio']>, string> = {
  square: 'aspect-square',
  video: 'aspect-video',
  wide: 'aspect-[3/1]',
}

export function ImageUpload({
  bucket,
  path,
  currentUrl,
  onUpload,
  aspectRatio = 'video',
  label = 'Upload image',
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayUrl = preview ?? currentUrl ?? null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()
      // Overwrite if a current image exists (upsert=true for canonical paths like featured/avatar)
      const upsert = !!currentUrl
      const publicUrl = await uploadImage(supabase, bucket, path, file, upsert)
      onUpload(publicUrl)
    } catch (err) {
      setError('Upload failed. Please try again.')
      setPreview(null)
      console.error('ImageUpload error:', err)
    } finally {
      setUploading(false)
      // Reset input so the same file can be re-selected after an error
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !uploading && inputRef.current?.click()}
        className={cn(
          aspectClasses[aspectRatio],
          'relative w-full rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/40',
          'flex cursor-pointer items-center justify-center overflow-hidden',
          'transition-colors hover:border-talwa-teal/60 hover:bg-muted/60',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        {displayUrl ? (
          <>
            <Image
              src={displayUrl}
              alt="Preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
            />
            {!uploading && (
              <button
                type="button"
                aria-label="Remove image"
                onClick={handleClear}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-8 w-8" />
            <span className="text-sm">{label}</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
