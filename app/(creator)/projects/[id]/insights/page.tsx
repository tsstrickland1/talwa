import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InsightsPanelClient } from './InsightsPanelClient'
import type { Project, Feature, Theme, DataPoint } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function InsightsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const [projectResult, featuresResult, themesResult, dataPointsResult] =
    await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('features').select('*').eq('project_id', id),
      supabase.from('themes').select('*').eq('project_id', id),
      supabase.from('data_points').select('*').eq('project_id', id),
    ])

  if (!projectResult.data) notFound()

  return (
    <InsightsPanelClient
      project={projectResult.data as Project}
      features={(featuresResult.data ?? []) as Feature[]}
      themes={(themesResult.data ?? []) as Theme[]}
      dataPoints={(dataPointsResult.data ?? []) as DataPoint[]}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
    />
  )
}
