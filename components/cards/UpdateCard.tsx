import ReactMarkdown from 'react-markdown'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProjectUpdate } from '@/lib/types'

type UpdateCardProps = {
  update: ProjectUpdate
}

export function UpdateCard({ update }: UpdateCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{update.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {format(new Date(update.created_at), 'MMMM d, yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        <ReactMarkdown
          className="prose prose-sm max-w-none prose-p:text-talwa-navy/80"
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
          }}
        >
          {update.content}
        </ReactMarkdown>
      </CardContent>
    </Card>
  )
}
