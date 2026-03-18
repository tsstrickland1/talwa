'use client'

import { MapPin, X, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Feature } from '@/lib/types'

interface TagFeaturePromptProps {
  activeFeature: Feature | null
  onGoToMap: () => void
  onDrawNewFeature: () => void
  onConfirm: () => void
  onDismiss: () => void
}

export function TagFeaturePrompt({
  activeFeature,
  onGoToMap,
  onDrawNewFeature,
  onConfirm,
  onDismiss,
}: TagFeaturePromptProps) {
  return (
    <div className="rounded-xl border border-talwa-teal/20 bg-talwa-sky/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-talwa-teal/10">
        <MapPin className="w-3.5 h-3.5 text-talwa-teal shrink-0" />
        <span className="flex-1 text-xs font-medium text-talwa-teal">Tag a feature</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-3 flex flex-col gap-3">
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
                onClick={onConfirm}
              >
                Tag this feature
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
              Tap a feature on the map to select it, or draw a new one.
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
    </div>
  )
}
