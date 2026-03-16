/**
 * POST /api/admin/geocode-projects
 *
 * Backfills `lat`, `lng`, and `neighborhood` for projects that are missing them.
 * Protected by SUPABASE_SECRET_KEY — call with:
 *   Authorization: Bearer <SUPABASE_SECRET_KEY>
 *
 * Strategy for each project.location (format: "City, State — Neighborhood Description"):
 *   1. Parse neighborhood text = substring after " — " (strip parenthetical details)
 *   2. Build geocode query = "<neighborhood>, <city portion>"
 *   3. Call Mapbox Geocoding API → take first result's center as lat/lng
 *   4. From the Mapbox response context, extract the neighborhood-level place name
 *      (place_type = "neighborhood" or "locality"); fall back to the parsed text
 *   5. UPDATE projects SET lat, lng, neighborhood WHERE id = ?
 *
 * Returns a JSON summary: { updated: number, skipped: number, failed: string[] }
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Project } from '@/lib/types'

// Separate the neighborhood segment from "City, State — Neighborhood (details)"
function parseLocationParts(location: string): { cityPart: string; neighborhoodRaw: string | null } {
  const sep = location.indexOf('—')
  if (sep === -1) {
    return { cityPart: location.trim(), neighborhoodRaw: null }
  }
  const cityPart = location.slice(0, sep).trim()
  let neighborhoodRaw = location.slice(sep + 1).trim()
  // Strip trailing parentheticals: "SE Division Street (20th–50th Ave)" → "SE Division Street"
  neighborhoodRaw = neighborhoodRaw.replace(/\s*\([^)]*\)/g, '').trim()
  return { cityPart, neighborhoodRaw: neighborhoodRaw || null }
}

async function geocodeLocation(
  query: string,
  mapboxToken: string
): Promise<{ lat: number; lng: number; neighborhood: string | null } | null> {
  const encoded = encodeURIComponent(query)
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
    `?access_token=${mapboxToken}&limit=1&types=neighborhood,locality,place,address`

  const res = await fetch(url)
  if (!res.ok) return null

  const json = await res.json()
  const feature = json.features?.[0]
  if (!feature) return null

  const [lng, lat] = feature.center as [number, number]

  // Try to find a neighborhood-level name in the result or its context
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

export async function POST(request: Request) {
  // Auth check — must present the secret key
  const authHeader = request.headers.get('Authorization') ?? ''
  const secret = process.env.SUPABASE_SECRET_KEY ?? ''
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
  if (!mapboxToken) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_MAPBOX_TOKEN not set' }, { status: 500 })
  }

  const admin = createAdminClient()

  // Fetch projects that still need geocoding (null lat means not yet done)
  const { data: projects, error } = await admin
    .from('projects')
    .select('id, location, lat, lng, neighborhood')
    .is('lat', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let updated = 0
  let skipped = 0
  const failed: string[] = []

  for (const project of (projects ?? []) as Pick<Project, 'id' | 'location' | 'lat' | 'lng' | 'neighborhood'>[]) {
    if (!project.location) {
      skipped++
      continue
    }

    const { cityPart, neighborhoodRaw } = parseLocationParts(project.location)

    // Build the best geocode query: "Neighborhood, City" if we have a hood, otherwise just city
    const geocodeQuery = neighborhoodRaw
      ? `${neighborhoodRaw}, ${cityPart}`
      : cityPart

    try {
      const result = await geocodeLocation(geocodeQuery, mapboxToken)
      if (!result) {
        failed.push(`${project.id}: no geocode result for "${geocodeQuery}"`)
        continue
      }

      // Prefer the Mapbox-verified neighborhood name; fall back to what we parsed
      const neighborhoodName = result.neighborhood ?? neighborhoodRaw ?? null

      await admin
        .from('projects')
        .update({ lat: result.lat, lng: result.lng, neighborhood: neighborhoodName })
        .eq('id', project.id)

      updated++
    } catch (err) {
      failed.push(`${project.id}: ${String(err)}`)
    }

    // Respect Mapbox's rate limit (5 req/s on free tier)
    await new Promise((r) => setTimeout(r, 220))
  }

  return NextResponse.json({ updated, skipped, failed })
}
