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
import type { CreatorProfile } from '@/lib/types'

export default function ProfileEditPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('creator_profiles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const p = data as CreatorProfile
          setProfile(p)
          setName(p.name)
          setDescription(p.description ?? '')
        }
      })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!profile) {
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
