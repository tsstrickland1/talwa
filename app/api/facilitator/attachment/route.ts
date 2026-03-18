import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeFileFromVectorStore } from '@/lib/openai/vectorStore'

export async function DELETE(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json() as {
    type: 'image' | 'document'
    storagePath?: string
    vectorStoreId?: string
    fileId?: string
  }

  if (body.type === 'image') {
    if (!body.storagePath) {
      return new Response('Missing storagePath', { status: 400 })
    }
    const admin = createAdminClient()
    const { error } = await admin.storage
      .from('conversation-attachments')
      .remove([body.storagePath])
    if (error) {
      console.error('Failed to delete image from storage:', error)
      return new Response('Delete failed', { status: 500 })
    }
    return new Response(null, { status: 204 })
  }

  if (body.type === 'document') {
    if (!body.vectorStoreId || !body.fileId) {
      return new Response('Missing vectorStoreId or fileId', { status: 400 })
    }
    try {
      await removeFileFromVectorStore(body.vectorStoreId, body.fileId)
    } catch (err) {
      console.error('Failed to remove document from vector store:', err)
      return new Response('Delete failed', { status: 500 })
    }
    return new Response(null, { status: 204 })
  }

  return new Response('Invalid type', { status: 400 })
}
