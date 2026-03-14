'use client'

import dynamic from 'next/dynamic'

const MapContainer = dynamic(
  () => import('@/components/map/MapContainer').then((m) => m.MapContainer),
  { ssr: false }
)

type Props = {
  mapboxToken: string
}

export function ExploreMap({ mapboxToken }: Props) {
  return (
    <MapContainer
      mapboxToken={mapboxToken}
      center={[-87.6298, 41.8781]}
      zoom={11}
      features={[]}
      className="h-full w-full"
    />
  )
}
