import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContributorChatPanel } from './ContributorChatPanel'
import type { Project, Feature } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ContributorProjectPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect(`/login?next=/projects/${id}`)
  }

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const { data: features } = await supabase
    .from('features')
    .select('*')
    .eq('project_id', id)

  const admin = createAdminClient()

  // Create or find existing conversation for this user + project
  const { data: conversation, error } = await admin
    .from('conversations')
    .upsert(
      {
        project_id: id,
        creator_id: authUser.id,
        extraction_status: 'pending',
      },
      { onConflict: 'project_id,creator_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error || !conversation) {
    // Fallback: fetch existing
    const { data: existing } = await admin
      .from('conversations')
      .select('id')
      .eq('project_id', id)
      .eq('creator_id', authUser.id)
      .single()

    if (!existing) {
      throw new Error('Could not create or find conversation')
    }

    return (
      <div className="h-[calc(100vh-3.5rem)]">
        <ContributorChatPanel
          project={project as Project}
          features={(features ?? []) as Feature[]}
          conversationId={existing.id}
          mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
        />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <ContributorChatPanel
        project={project as Project}
        features={(features ?? []) as Feature[]}
        conversationId={conversation.id}
        mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
      />
    </div>
  )
}
