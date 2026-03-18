'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'

export default function NewOrganizationPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const name = formData.get('name') as string
    const description = formData.get('description') as string

    // Generate slug from name
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    if (!slug) slug = `org-${Date.now()}`

    // Create the creator profile
    const { data: profile, error: profileError } = await supabase
      .from('creator_profiles')
      .insert({
        type: 'organization',
        name,
        slug,
        description: description ?? '',
      })
      .select('id')
      .single()

    if (profileError || !profile) {
      // Handle slug conflict
      if (profileError?.code === '23505') {
        slug = `${slug}-${Date.now().toString(36)}`
        const { data: retry, error: retryError } = await supabase
          .from('creator_profiles')
          .insert({
            type: 'organization',
            name,
            slug,
            description: description ?? '',
          })
          .select('id')
          .single()

        if (retryError || !retry) {
          setError(retryError?.message ?? 'Failed to create organization')
          setIsLoading(false)
          return
        }

        // Add current user as owner
        await supabase.from('organization_members').insert({
          creator_profile_id: retry.id,
          user_id: user.id,
          role: 'owner',
        })

        router.push(`/organizations/${retry.id}`)
        return
      }

      setError(profileError?.message ?? 'Failed to create organization')
      setIsLoading(false)
      return
    }

    // Add current user as owner
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        creator_profile_id: profile.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      setError('Organization created but failed to set you as owner')
      setIsLoading(false)
      return
    }

    router.push(`/organizations/${profile.id}`)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-heading text-3xl font-bold text-talwa-navy mb-6">
        New Organization
      </h1>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Portland Urban Design Lab"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Tell people about your organization and what kind of projects you work on..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create organization'}
          </Button>
        </div>
      </form>
    </div>
  )
}
