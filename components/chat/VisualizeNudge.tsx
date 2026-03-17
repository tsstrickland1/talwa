'use client'

import { Sparkles, X, PenLine, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VisualizeNudgeProps {
  onGoToMap: () => void
  onDismiss: () => void
}

export function VisualizeNudge({ onGoToMap, onDismiss }: VisualizeNudgeProps) {
  return (
    <div className="rounded-xl border border-talwa-teal/20 bg-talwa-sky/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-talwa-teal/10">
        <Sparkles className="w-3.5 h-3.5 text-talwa-teal shrink-0" />
        <span className="flex-1 text-xs font-medium text-talwa-teal">Visualize</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-talwa-sky/40 flex items-center justify-center shrink-0 mt-0.5">
            <PenLine className="w-4 h-4 text-talwa-teal" />
          </div>
          <div>
            <p className="text-sm font-medium text-talwa-navy">Mark a feature on the map first</p>
            <p className="text-sm text-muted-foreground mt-1">
              To generate a design sketch, you need to identify the specific place you have in
              mind — a path, park, plaza, or landmark. Use the drawing tools in the top-right
              of the map to trace it out.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-talwa-teal hover:bg-talwa-teal/90 text-white gap-1.5"
            onClick={onGoToMap}
          >
            <Map className="w-3.5 h-3.5" />
            Go to map
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
