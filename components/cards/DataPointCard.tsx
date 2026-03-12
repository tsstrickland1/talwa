import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { DataPoint } from '@/lib/types'

type DataPointCardProps = {
  dataPoint: DataPoint
  featureName?: string
  themeNames?: string[]
  onClick?: () => void
}

export function DataPointCard({
  dataPoint,
  featureName,
  themeNames = [],
  onClick,
}: DataPointCardProps) {
  return (
    <Card
      className={`transition-all hover:shadow-sm ${onClick ? 'cursor-pointer hover:border-talwa-sky' : ''}`}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-start gap-2 mb-3">
          {dataPoint.location && (
            <MapPin className="h-4 w-4 text-talwa-burnt-orange shrink-0 mt-0.5" />
          )}
          <blockquote className="text-sm text-talwa-navy leading-relaxed italic flex-1">
            "{dataPoint.content}"
          </blockquote>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {featureName && (
            <Badge variant="outline" className="text-xs">
              {featureName}
            </Badge>
          )}
          {themeNames.slice(0, 3).map((name) => (
            <Badge key={name} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
