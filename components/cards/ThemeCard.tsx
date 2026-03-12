import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Theme } from '@/lib/types'

type ThemeCardProps = {
  theme: Theme
  dataPointCount?: number
  onClick?: () => void
  isSelected?: boolean
}

export function ThemeCard({
  theme,
  dataPointCount = 0,
  onClick,
  isSelected = false,
}: ThemeCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'ring-2 ring-talwa-teal border-talwa-teal'
          : 'hover:border-talwa-sky'
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{theme.name}</CardTitle>
          <Badge variant="sky" className="shrink-0 text-xs">
            {dataPointCount} {dataPointCount === 1 ? 'point' : 'points'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 font-sans">
          {theme.research_question.slice(0, 60)}
          {theme.research_question.length > 60 ? '…' : ''}
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-talwa-navy/80 leading-relaxed">{theme.summary}</p>
      </CardContent>
    </Card>
  )
}
