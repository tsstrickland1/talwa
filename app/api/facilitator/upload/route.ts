import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storagePaths, getFileExtension } from '@/lib/supabase/storage'
import {
  getOrCreateConversationVectorStore,
  addFileToConversationVectorStore,
} from '@/lib/openai/vectorStore'


const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const conversationId = formData.get('conversation_id') as string | null

  if (!file || !conversationId) {
    return new Response('Missing file or conversation_id', { status: 400 })
  }

  // Verify the conversation belongs to this user
  const admin = createAdminClient()
  const { data: conversation, error: convError } = await admin
    .from('conversations')
    .select('id, creator_id')
    .eq('id', conversationId)
    .eq('creator_id', user.id)
    .single()

  if (convError || !conversation) {
    return new Response('Conversation not found', { status: 404 })
  }

  // Route by file type
  if (IMAGE_TYPES.has(file.type)) {
    // Image: upload to Supabase public bucket and return CDN URL
    const ext = getFileExtension(file)
    const path = storagePaths.conversationAttachment(conversationId, ext)
    const arrayBuffer = await file.arrayBuffer()
    const { error } = await admin.storage
      .from('conversation-attachments')
      .upload(path, arrayBuffer, { contentType: file.type })
    if (error) {
      return new Response('Upload failed', { status: 500 })
    }
    const { data } = admin.storage.from('conversation-attachments').getPublicUrl(path)
    return Response.json({ type: 'image', url: data.publicUrl, storagePath: path })
  }

  // Document: upload to OpenAI vector store
  const vectorStoreId = await getOrCreateConversationVectorStore(conversationId, admin)
  const arrayBuffer = await file.arrayBuffer()
  const fileId = await addFileToConversationVectorStore(vectorStoreId, arrayBuffer, file.name, file.type)

  return Response.json({ type: 'document', name: file.name, vectorStoreId, fileId })
}
