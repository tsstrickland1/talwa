'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type GeoResult =
  | { updated: number; skipped: number; failed: string[] }
  | { error: string }

function parseLocationParts(location: string): { cityPart: string; neighborhoodRaw: string | null } {
  const sep = location.indexOf('—')
  if (sep === -1) return { cityPart: location.trim(), neighborhoodRaw: null }
  const cityPart = location.slice(0, sep).trim()
  let neighborhoodRaw = location.slice(sep + 1).trim()
  neighborhoodRaw = neighborhoodRaw.replace(/\s*\([^)]*\)/g, '').trim()
  return { cityPart, neighborhoodRaw: neighborhoodRaw || null }
}

async function geocodeQuery(
  query: string,
  token: string
): Promise<{ lat: number; lng: number; neighborhood: string | null } | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${token}&limit=1&types=neighborhood,locality,place,address`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const feature = json.features?.[0]
  if (!feature) return null
  const [lng, lat] = feature.center as [number, number]
  let neighborhood: string | null = null
  if (feature.place_type?.includes('neighborhood') || feature.place_type?.includes('locality')) {
    neighborhood = feature.text as string
  } else if (Array.isArray(feature.context)) {
    const hood = (feature.context as Array<{ id: string; text: string }>).find(
      (c) => c.id.startsWith('neighborhood.') || c.id.startsWith('locality.')
    )
    if (hood) neighborhood = hood.text
  }
  return { lat, lng, neighborhood }
}

export async function geocodeProjectsAction(): Promise<GeoResult> {
  // Verify the caller is an authenticated admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (!profile || profile.user_type !== 'admin') {
    return { error: 'Admin access required' }
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
  if (!mapboxToken) return { error: 'Mapbox token not configured' }

  const admin = createAdminClient()
  const { data: projects, error } = await admin
    .from('projects')
    .select('id, location')
    .is('lat', null)

  if (error) return { error: error.message }

  let updated = 0
  let skipped = 0
  const failed: string[] = []

  for (const project of projects ?? []) {
    if (!project.location) { skipped++; continue }

    const { cityPart, neighborhoodRaw } = parseLocationParts(project.location)
    const query = neighborhoodRaw ? `${neighborhoodRaw}, ${cityPart}` : cityPart

    try {
      const result = await geocodeQuery(query, mapboxToken)
      if (!result) { failed.push(project.id); continue }

      const neighborhoodName = result.neighborhood ?? neighborhoodRaw ?? null
      await admin
        .from('projects')
        .update({ lat: result.lat, lng: result.lng, neighborhood: neighborhoodName })
        .eq('id', project.id)
      updated++
    } catch {
      failed.push(project.id)
    }

    await new Promise((r) => setTimeout(r, 220))
  }

  return { updated, skipped, failed }
}
