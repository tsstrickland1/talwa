import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContributorChatPanel } from './ContributorChatPanel'
import type { Project, Feature, User } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ContributorProjectPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // Fetch project using admin client so RLS doesn't block unauthenticated reads
  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const { data: features } = await admin
    .from('features')
    .select('*')
    .eq('project_id', id)

  // Resolve creator profile for display
  const { data: creatorProfile } = await admin
    .from('creator_profiles')
    .select('id, name, avatar')
    .eq('id', project.creator_profile_id)
    .single()

  // Build a creator object compatible with the existing UI
  const nameParts = (creatorProfile?.name ?? '').split(' ')
  const creator = creatorProfile
    ? {
        id: creatorProfile.id,
        name_first: nameParts[0] ?? '',
        name_last: nameParts.slice(1).join(' '),
        avatar: creatorProfile.avatar,
      }
    : null

  // If user is not authenticated, render the panel without a conversation
  if (!authUser) {
    return (
      <div className="h-screen">
        <ContributorChatPanel
          project={project as Project}
          features={(features ?? []) as Feature[]}
          conversationId={null}
          userId={null}
          mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
          creator={creator as Pick<User, 'id' | 'name_first' | 'name_last' | 'avatar'> | null}
        />
      </div>
    )
  }

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
      <div className="h-screen">
        <ContributorChatPanel
          project={project as Project}
          features={(features ?? []) as Feature[]}
          conversationId={existing.id}
          userId={authUser.id}
          mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
          creator={creator as Pick<User, 'id' | 'name_first' | 'name_last' | 'avatar'> | null}
        />
      </div>
    )
  }

  return (
    <div className="h-screen">
      <ContributorChatPanel
        project={project as Project}
        features={(features ?? []) as Feature[]}
        conversationId={conversation.id}
        userId={authUser.id}
        mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
        creator={creator as Pick<User, 'id' | 'name_first' | 'name_last' | 'avatar'> | null}
      />
    </div>
  )
}
