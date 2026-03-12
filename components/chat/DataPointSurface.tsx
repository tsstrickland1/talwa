'use client'

import { X, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DataPoint } from '@/lib/types'

type DataPointSurfaceProps = {
  dataPoint: DataPoint | null
  featureName?: string
  themeNames?: string[]
  onDismiss?: () => void
}

export function DataPointSurface({
  dataPoint,
  featureName,
  themeNames = [],
  onDismiss,
}: DataPointSurfaceProps) {
  if (!dataPoint) return null

  return (
    <div className="mx-2 my-1 rounded-xl border border-talwa-olive-light bg-talwa-olive-light/20 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {dataPoint.location && (
            <MapPin className="h-4 w-4 text-talwa-burnt-orange shrink-0 mt-0.5" />
          )}
          <span className="text-xs font-medium text-talwa-navy/60 uppercase tracking-wide">
            Community Perspective
          </span>
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

      <blockquote className="text-sm text-talwa-navy leading-relaxed mb-3 italic">
        "{dataPoint.content}"
      </blockquote>

      <div className="flex flex-wrap gap-1.5">
        {featureName && (
          <Badge variant="outline" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {featureName}
          </Badge>
        )}
        {themeNames.map((name) => (
          <Badge key={name} variant="secondary" className="text-xs">
            {name}
          </Badge>
        ))}
        <Badge variant="olive" className="text-xs">
          {dataPoint.research_question.slice(0, 40)}
          {dataPoint.research_question.length > 40 ? '…' : ''}
        </Badge>
      </div>
    </div>
  )
}
