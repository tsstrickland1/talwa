'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CreatorProfile } from '@/lib/types'

export default function NewProjectPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<string[]>([''])
  const [profiles, setProfiles] = useState<CreatorProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  useEffect(() => {
    fetch('/api/creator-profiles')
      .then((r) => r.json())
      .then((data) => {
        const list = (data.profiles ?? []) as CreatorProfile[]
        setProfiles(list)
        if (list.length > 0) {
          // Default to individual profile, or first available
          const individual = list.find((p) => p.type === 'individual')
          setSelectedProfileId(individual?.id ?? list[0].id)
        }
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!selectedProfileId) {
      setError('Please select a creator profile')
      setIsLoading(false)
      return
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: formData.get('name') as string,
        short_description: formData.get('short_description') as string,
        long_description: formData.get('long_description') as string,
        location: formData.get('location') as string,
        status: 'draft',
        publicly_visible: false,
        creator_profile_id: selectedProfileId,
        dialogue_framework: questions.filter((q) => q.trim()),
      })
      .select('id')
      .single()

    if (projectError || !project) {
      setError(projectError?.message ?? 'Failed to create project')
      setIsLoading(false)
      return
    }

    // Create analytical framework if research questions provided
    const researchQuestions = questions.filter((q) => q.trim())
    if (researchQuestions.length > 0) {
      await supabase.from('analytical_frameworks').insert({
        project_id: project.id,
        name: 'Primary Framework',
        research_questions: researchQuestions,
        creator_id: user.id,
      })
    }

    router.push(`/projects/${project.id}/configure`)
  }

  const addQuestion = () => setQuestions((prev) => [...prev, ''])
  const removeQuestion = (i: number) => setQuestions((prev) => prev.filter((_, idx) => idx !== i))
  const updateQuestion = (i: number, value: string) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? value : q)))

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-heading text-3xl font-bold text-talwa-navy mb-6">
        New Project
      </h1>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile selector — only show if user has multiple profiles */}
        {profiles.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create Under</CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose which profile or organization will own this project.
              </p>
            </CardHeader>
            <CardContent>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.type === 'organization' ? ' (Org)' : ''}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Downtown Park Redesign"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                placeholder="Portland, OR"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short_description">Short description</Label>
              <Input
                id="short_description"
                name="short_description"
                placeholder="Brief summary shown in project cards (1-2 sentences)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="long_description">Full description</Label>
              <Textarea
                id="long_description"
                name="long_description"
                placeholder="Detailed description of the project, its goals, and what kind of community input you're seeking…"
                rows={5}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dialogue Framework</CardTitle>
            <p className="text-sm text-muted-foreground">
              Research questions guide the AI facilitator&apos;s conversation with contributors.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Badge variant="secondary" className="shrink-0 text-xs w-6 h-6 rounded-full flex items-center justify-center p-0">
                    {i + 1}
                  </Badge>
                  <Input
                    value={q}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    placeholder={`Research question ${i + 1}`}
                  />
                </div>
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => removeQuestion(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addQuestion}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add question
            </Button>
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
            {isLoading ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </div>
  )
}
