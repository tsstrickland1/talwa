'use client'

import { X, MessageSquare, Map as MapIcon, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Theme, DataPoint } from '@/lib/types'

type ThemeSurfaceProps = {
  theme: Theme | null
  dataPoints?: DataPoint[]
  onDismiss?: () => void
  onDetailView?: () => void
  onViewMap?: () => void // mobile only — switch to map tab
}

export function ThemeSurface({
  theme,
  dataPoints = [],
  onDismiss,
  onDetailView,
  onViewMap,
}: ThemeSurfaceProps) {
  if (!theme) return null

  return (
    <div className="mx-2 my-1 rounded-xl border border-talwa-sky bg-talwa-sky/20 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-talwa-teal shrink-0 mt-0.5" />
          <h4 className="text-sm font-semibold text-talwa-navy font-heading">
            {theme.name}
          </h4>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <p className="text-xs text-talwa-navy/80 leading-relaxed mb-3">
        {theme.summary}
      </p>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="sky" className="text-xs">
          {dataPoints.length} {dataPoints.length === 1 ? 'perspective' : 'perspectives'}
        </Badge>
        <div className="flex items-center gap-2">
          {onViewMap && (
            <button
              onClick={onViewMap}
              className="md:hidden flex items-center gap-1 text-xs text-talwa-teal hover:text-talwa-teal/80 transition-colors"
            >
              <MapIcon className="h-3 w-3" />
              View on map
            </button>
          )}
          {onDetailView && dataPoints.length > 0 && (
            <button
              onClick={onDetailView}
              className="flex items-center gap-1 text-xs font-medium text-talwa-teal hover:text-talwa-teal/80 transition-colors"
            >
              Explore perspectives
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
