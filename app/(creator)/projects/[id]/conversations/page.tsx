import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import type { Conversation, Message } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

const statusVariant: Record<Conversation['extraction_status'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  processing: 'default',
  complete: 'secondary',
  failed: 'destructive',
}

export default async function ConversationsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()

  const [projectResult, conversationsResult] = await Promise.all([
    admin.from('projects').select('name').eq('id', id).single(),
    admin
      .from('conversations')
      .select('*, messages(count)')
      .eq('project_id', id)
      .order('last_message_at', { ascending: false }),
  ])

  if (!projectResult.data) notFound()

  const conversations = conversationsResult.data ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-heading text-2xl font-bold text-talwa-navy mb-2">
        Conversations
      </h1>
      <p className="text-talwa-navy/60 mb-6">
        {conversations.length} total conversations in {projectResult.data.name}.
      </p>

      {conversations.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-2">
            No conversations yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Community conversations will appear here once contributors engage.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-white hover:border-talwa-sky transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-talwa-navy">
                  Conversation {conv.id.slice(0, 8)}…
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last message: {format(new Date(conv.last_message_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <Badge variant={statusVariant[conv.extraction_status as Conversation['extraction_status']]} className="text-xs capitalize">
                {conv.extraction_status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
