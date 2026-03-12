'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Project } from '@/lib/types'

export default function ConfigurePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
      .then(({ data }) => {
        if (data) setProject(data as Project)
      })
  }, [projectId])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!project) return
    setIsSaving(true)

    const formData = new FormData(e.currentTarget)
    const { error } = await supabase
      .from('projects')
      .update({
        name: formData.get('name') as string,
        short_description: formData.get('short_description') as string,
        long_description: formData.get('long_description') as string,
        location: formData.get('location') as string,
        status: formData.get('status') as string,
        publicly_visible: formData.get('publicly_visible') === 'on',
      })
      .eq('id', projectId)

    setIsSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-heading text-2xl font-bold text-talwa-navy mb-6">
        Configure Project
      </h1>

      <form onSubmit={handleSave} className="space-y-6">
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
                defaultValue={project.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                defaultValue={project.location}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short_description">Short description</Label>
              <Input
                id="short_description"
                name="short_description"
                defaultValue={project.short_description}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="long_description">Full description</Label>
              <Textarea
                id="long_description"
                name="long_description"
                defaultValue={project.long_description}
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visibility & Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={project.status}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="publicly_visible"
                name="publicly_visible"
                defaultChecked={project.publicly_visible}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="publicly_visible" className="cursor-pointer">
                Publicly visible in Explore
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
