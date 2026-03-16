import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FeaturesWrapper } from './FeaturesWrapper'
import type { Feature } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function FeaturesPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [projectResult, featuresResult] = await Promise.all([
    supabase.from('projects').select('name, lat, lng').eq('id', id).single(),
    supabase.from('features').select('*').eq('project_id', id).order('created_at'),
  ])

  if (!projectResult.data) notFound()

  const project = projectResult.data
  const features = (featuresResult.data ?? []) as Feature[]

  // Default map center: use project coordinates if geocoded, otherwise NYC
  const center: [number, number] =
    project.lat && project.lng
      ? [project.lng, project.lat]
      : [-73.9857, 40.7484]

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="font-heading text-2xl font-bold text-talwa-navy mb-0.5">
          Map Features
        </h1>
        <p className="text-sm text-talwa-navy/60">
          Draw geographic features contributors can reference during conversations.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <FeaturesWrapper
          projectId={id}
          initialFeatures={features}
          mapboxToken={mapboxToken}
          center={center}
        />
      </div>
    </div>
  )
}
