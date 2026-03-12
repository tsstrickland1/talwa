'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { UpdateCard } from '@/components/cards/UpdateCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'
import type { ProjectUpdate } from '@/lib/types'

export default function UpdatesPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [showForm, setShowForm] = useState(false)
  const [isPosting, setIsPosting] = useState(false)

  useEffect(() => {
    supabase
      .from('project_updates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setUpdates(data as ProjectUpdate[])
      })
  }, [projectId])

  async function handlePost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPosting(true)
    const formData = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('project_updates')
      .insert({
        project_id: projectId,
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        creator_id: user!.id,
      })
      .select()
      .single()

    if (!error && data) {
      setUpdates((prev) => [data as ProjectUpdate, ...prev])
      setShowForm(false)
      ;(e.target as HTMLFormElement).reset()
    }
    setIsPosting(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-talwa-navy">
          Project Updates
        </h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Post update
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 border-talwa-teal">
          <CardHeader>
            <CardTitle className="text-base">New Update</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePost} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" placeholder="Update title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content (Markdown supported)</Label>
                <Textarea
                  id="content"
                  name="content"
                  placeholder="Share what's new with the project…"
                  rows={5}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPosting}>
                  {isPosting ? 'Posting…' : 'Post update'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {updates.length === 0 && !showForm ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">📢</div>
          <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-2">
            No updates yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Keep your community informed with project updates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => (
            <UpdateCard key={update.id} update={update} />
          ))}
        </div>
      )}
    </div>
  )
}
