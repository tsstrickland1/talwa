'use client'

import Image from 'next/image'
import { X, Sparkles } from 'lucide-react'
import type { Sketch } from '@/lib/types'

interface SketchSurfaceProps {
  sketch: Sketch
  featureName?: string
  onDismiss: () => void
}

export function SketchSurface({ sketch, featureName, onDismiss }: SketchSurfaceProps) {
  return (
    <div className="rounded-xl border border-talwa-teal/20 bg-talwa-sky/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-talwa-teal/10">
        <div className="flex items-center gap-1.5 text-xs text-talwa-teal font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {featureName ? `Sketch — ${featureName}` : 'Generated sketch'}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss sketch"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative aspect-square w-full max-w-xs mx-auto">
        <Image
          src={sketch.image}
          alt={sketch.caption || 'Generated sketch'}
          fill
          className="object-cover"
          sizes="320px"
        />
      </div>

      {sketch.caption && (
        <p className="px-3 py-2 text-xs text-muted-foreground">{sketch.caption}</p>
      )}
    </div>
  )
}
