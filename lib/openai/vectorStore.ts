import OpenAI, { toFile } from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const EXPIRATION_DAYS = 2

/**
 * Returns the OpenAI vector store ID for a conversation.
 * Creates one (with a 2-day last-active expiration) if none exists yet,
 * and persists the ID to the conversations table.
 */
export async function getOrCreateConversationVectorStore(
  conversationId: string,
  adminClient: SupabaseClient
): Promise<string> {
  // Check if a vector store already exists for this conversation
  const { data } = await adminClient
    .from('conversations')
    .select('vector_store_id')
    .eq('id', conversationId)
    .single()

  if (data?.vector_store_id) {
    return data.vector_store_id
  }

  // Create a new vector store with automatic expiration
  const vectorStore = await openai.beta.vectorStores.create({
    name: `conversation-${conversationId}`,
    expires_after: { anchor: 'last_active_at', days: EXPIRATION_DAYS },
  })

  // Persist the ID so we reuse it on subsequent uploads
  await adminClient
    .from('conversations')
    .update({ vector_store_id: vectorStore.id })
    .eq('id', conversationId)

  return vectorStore.id
}

/**
 * Uploads a file to the OpenAI Files API and adds it to the given vector store.
 * Waits for processing to complete before returning.
 * Returns the OpenAI file ID.
 */
export async function addFileToConversationVectorStore(
  vectorStoreId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const blob = new Blob([fileBuffer], { type: mimeType })
  const file = await toFile(blob, filename, { type: mimeType })

  const uploaded = await openai.files.create({ file, purpose: 'assistants' })

  // Add to vector store and poll until processing is done
  await openai.beta.vectorStores.files.createAndPoll(vectorStoreId, {
    file_id: uploaded.id,
  })

  return uploaded.id
}

/**
 * Queries a vector store for chunks relevant to the given query string.
 * Returns up to `maxResults` text chunks (default 5), each capped at 800 chars.
 */
export async function queryVectorStore(
  vectorStoreId: string,
  query: string,
  maxResults = 5
): Promise<string[]> {
  const response = await openai.beta.vectorStores.search(vectorStoreId, {
    query,
    max_num_results: maxResults,
  })

  type TextBlock = { type: 'text'; text: { value: string } }
  return response.data.flatMap((result) =>
    (result.content as Array<{ type: string; text?: { value: string } }>)
      .filter((block): block is TextBlock => block.type === 'text' && block.text != null)
      .map((block) => block.text.value.slice(0, 800))
  )
}
