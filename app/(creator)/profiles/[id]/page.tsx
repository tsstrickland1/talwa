'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { storagePaths } from '@/lib/supabase/storage'
import type { CreatorProfile } from '@/lib/types'

export default function ProfileEditPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: { user } }, { data: profileData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('creator_profiles').select('*').eq('id', id).single(),
      ])
      if (user) setUserId(user.id)
      if (profileData) {
        const p = profileData as CreatorProfile
        setProfile(p)
        setName(p.name)
        setDescription(p.description ?? '')
        setAvatarUrl(p.avatar)
      }
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAvatarUpload(url: string) {
    setAvatarUrl(url)
    await fetch(`/api/creator-profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: url }),
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    setError(null)

    const res = await fetch(`/api/creator-profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() }),
    })

    setIsSaving(false)

    if (!res.ok) {
      setError('Failed to save. Please try again.')
      return
    }

    const updated = await res.json() as CreatorProfile
    setProfile(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile || !userId) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="font-heading text-2xl font-bold text-talwa-navy mb-6">
        Edit Profile
      </h1>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-[160px]">
              <ImageUpload
                bucket="avatars"
                path={storagePaths.avatar(userId, 'jpg')}
                currentUrl={avatarUrl}
                onUpload={handleAvatarUpload}
                aspectRatio="square"
                label="Upload photo"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Description{' '}
                <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="A short bio or description shown on your public profile…"
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-talwa-burnt-orange">{error}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving || !name.trim()} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
