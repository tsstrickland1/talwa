import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Buckets ──────────────────────────────────────────────────────────────────

export type PublicBucket = 'avatars' | 'project-images' | 'sketches' | 'conversation-attachments'
export type PrivateBucket = 'project-files'
export type StorageBucket = PublicBucket | PrivateBucket

// ─── Path Builders ────────────────────────────────────────────────────────────
// All path construction goes here — never build paths ad-hoc in components.

export const storagePaths = {
  /** avatars/{user_id}/avatar.{ext} — overwrites on update */
  avatar(userId: string, ext: string): string {
    return `${userId}/avatar.${ext}`
  },

  /** avatars/{user_id}/org-{profile_id}.jpg — org profile avatar uploaded by this user */
  orgAvatar(userId: string, profileId: string): string {
    return `${userId}/org-${profileId}.jpg`
  },

  /** project-images/{project_id}/featured.{ext} — overwrites on update */
  featuredImage(projectId: string, ext: string): string {
    return `${projectId}/featured.${ext}`
  },

  /** project-images/{project_id}/perspectives/{feature_id}/{timestamp}.{ext} */
  perspective(projectId: string, featureId: string, ext: string): string {
    return `${projectId}/perspectives/${featureId}/${Date.now()}.${ext}`
  },

  /** sketches/{project_id}/{user_id}/{timestamp}.png — used by AI generation */
  sketch(projectId: string, userId: string): string {
    return `${projectId}/${userId}/${Date.now()}.png`
  },

  /** project-files/{project_id}/{timestamp}-{filename} */
  projectFile(projectId: string, filename: string): string {
    return `${projectId}/${Date.now()}-${filename}`
  },

  /** conversation-attachments/{conversationId}/{timestamp}.{ext} */
  conversationAttachment(conversationId: string, ext: string): string {
    return `${conversationId}/${Date.now()}.${ext}`
  },
}

// ─── Upload Helpers ───────────────────────────────────────────────────────────

/**
 * Upload a file to a public bucket and return the CDN public URL.
 * Intended for client-side use with the browser Supabase client.
 * RLS on the bucket enforces authorization.
 */
export async function uploadImage(
  supabase: SupabaseClient,
  bucket: PublicBucket,
  path: string,
  file: File,
  upsert = false
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Upload a file to the private project-files bucket and return the storage path.
 * Intended for client-side use with the browser Supabase client.
 * Returns the storage path (not a public URL) — use getSignedFileUrl to retrieve it.
 */
export async function uploadProjectFile(
  supabase: SupabaseClient,
  path: string,
  file: File
): Promise<string> {
  const { error } = await supabase.storage.from('project-files').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

/**
 * Generate a short-lived signed URL for a private project file.
 * Must be called server-side (admin client) since project-files has no public read.
 *
 * @param storagePath  The path stored in project_files.file_url (e.g. "{project_id}/{ts}-{name}")
 * @param expiresIn    Seconds until the URL expires (default 1 hour)
 */
export async function getSignedFileUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data.signedUrl
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Extract file extension from a File object (lowercase, no dot) */
export function getFileExtension(file: File): string {
  const parts = file.name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin'
}
