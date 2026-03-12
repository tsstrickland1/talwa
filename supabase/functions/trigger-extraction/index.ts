import { createClient } from '@supabase/supabase-js'

// Deploy with: supabase functions deploy trigger-extraction --no-verify-jwt
// The function authenticates requests manually using EXTRACTION_SECRET.

Deno.serve(async (req: Request) => {
  // Manual authorization — no JWT verification (--no-verify-jwt flag used at deploy)
  const authHeader = req.headers.get('Authorization')
  const extractionSecret = Deno.env.get('EXTRACTION_SECRET')

  if (!extractionSecret || authHeader !== `Bearer ${extractionSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const nextjsUrl = Deno.env.get('NEXTJS_URL')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  // Find conversations ready for extraction
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('id, project_id')
    .eq('extraction_status', 'pending')
    .lt('last_message_at', fiveMinutesAgo)

  if (error) {
    console.error('Error querying conversations:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!conversations || conversations.length === 0) {
    return new Response(JSON.stringify({ triggered: 0, message: 'No conversations ready' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const conversationIds = conversations.map((c) => c.id)

  // Mark all as processing atomically before firing requests
  const { error: updateError } = await supabase
    .from('conversations')
    .update({ extraction_status: 'processing' })
    .in('id', conversationIds)

  if (updateError) {
    console.error('Error updating conversation statuses:', updateError)
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fire extraction for each conversation
  const results = await Promise.allSettled(
    conversations.map(async (conversation) => {
      const response = await fetch(`${nextjsUrl}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${extractionSecret}`,
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
          project_id: conversation.project_id,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Extract failed for ${conversation.id}: ${response.status} ${text}`)
      }

      return conversation.id
    })
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  // Re-mark failed ones so they can be retried
  if (failed > 0) {
    const failedIds = conversationIds.filter(
      (_, i) => results[i].status === 'rejected'
    )
    await supabase
      .from('conversations')
      .update({ extraction_status: 'failed' })
      .in('id', failedIds)
  }

  console.log(`Triggered extraction: ${succeeded} succeeded, ${failed} failed`)

  return new Response(
    JSON.stringify({
      triggered: conversations.length,
      succeeded,
      failed,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
