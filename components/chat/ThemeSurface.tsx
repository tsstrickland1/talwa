'use client'

import { X, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Theme, DataPoint } from '@/lib/types'

type ThemeSurfaceProps = {
  theme: Theme | null
  dataPoints?: DataPoint[]
  onDismiss?: () => void
  onViewAll?: () => void
}

export function ThemeSurface({
  theme,
  dataPoints = [],
  onDismiss,
  onViewAll,
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

      <div className="flex items-center justify-between">
        <Badge variant="sky" className="text-xs">
          {dataPoints.length} {dataPoints.length === 1 ? 'perspective' : 'perspectives'}
        </Badge>
        {onViewAll && dataPoints.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-xs text-talwa-teal underline underline-offset-2 hover:no-underline"
          >
            View all
          </button>
        )}
      </div>
    </div>
  )
}
