import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const conversation_id = searchParams.get('conversation_id')

  if (!conversation_id) {
    return new Response('Missing conversation_id', { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // Verify the authenticated user owns this conversation
  const { data: conversation } = await admin
    .from('conversations')
    .select('id')
    .eq('id', conversation_id)
    .eq('creator_id', user.id)
    .single()

  if (!conversation) {
    return new Response('Not found', { status: 404 })
  }

  const { data: messages, error } = await admin
    .from('messages')
    .select('id, sender, content')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })

  if (error) {
    return new Response('Failed to load messages', { status: 500 })
  }

  const formatted = (messages ?? []).map((m) => ({
    id: m.id,
    role: m.sender === 'human' ? 'user' : 'assistant',
    content: m.content,
  }))

  return Response.json({ messages: formatted })
}
