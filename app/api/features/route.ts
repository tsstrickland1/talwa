import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FeatureGeoJSON, FeatureType } from '@/lib/types'

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json() as {
    project_id: string
    name: string
    type: FeatureType
    description: string
    geojson: FeatureGeoJSON
  }

  const { project_id, name, type, description, geojson } = body

  if (!project_id || !name || !type || !geojson) {
    return new Response('Missing required fields', { status: 400 })
  }

  const admin = createAdminClient()

  // Determine whether caller is the project creator or a contributor
  const [projectResult, accessResult] = await Promise.all([
    admin.from('projects').select('creator_id').eq('id', project_id).single(),
    admin
      .from('project_access')
      .select('permissions')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!projectResult.data) {
    return new Response('Project not found', { status: 404 })
  }

  const isCreator = projectResult.data.creator_id === user.id
  const isContributor =
    accessResult.data?.permissions?.includes('contribute') ?? false

  if (!isCreator && !isContributor) {
    return new Response('Forbidden', { status: 403 })
  }

  const source = isCreator ? 'creator' : 'contributor'

  // Try inserting with source column (requires migration 0006).
  // Fall back to inserting without it in case the migration hasn't been applied yet.
  let insertResult = await admin
    .from('features')
    .insert({
      project_id,
      name,
      type,
      description: description ?? '',
      geojson,
      source,
      creator_id: user.id,
    })
    .select('*')
    .single()

  if (insertResult.error?.message?.includes('"source"')) {
    // Migration not yet applied — insert without the source column
    insertResult = await admin
      .from('features')
      .insert({
        project_id,
        name,
        type,
        description: description ?? '',
        geojson,
        creator_id: user.id,
      })
      .select('*')
      .single()
  }

  const { data, error } = insertResult

  if (error) {
    console.error('Failed to insert feature:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Attach source to the returned object even if the column doesn't exist in DB yet
  return Response.json({ ...data, source: (data as Record<string, unknown>).source ?? source }, { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const featureId = searchParams.get('id')

  if (!featureId) {
    return new Response('Missing feature id', { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch feature to check ownership / source
  const { data: feature } = await admin
    .from('features')
    .select('creator_id, source, project_id')
    .eq('id', featureId)
    .single()

  if (!feature) {
    return new Response('Not found', { status: 404 })
  }

  // Project creator can delete any feature; contributors only their own drawn ones
  const { data: project } = await admin
    .from('projects')
    .select('creator_id')
    .eq('id', feature.project_id)
    .single()

  const isProjectCreator = project?.creator_id === user.id
  const isOwnContributorFeature =
    feature.source === 'contributor' && feature.creator_id === user.id

  if (!isProjectCreator && !isOwnContributorFeature) {
    return new Response('Forbidden', { status: 403 })
  }

  const { error } = await admin.from('features').delete().eq('id', featureId)

  if (error) {
    return new Response('Failed to delete feature', { status: 500 })
  }

  return new Response(null, { status: 204 })
}
