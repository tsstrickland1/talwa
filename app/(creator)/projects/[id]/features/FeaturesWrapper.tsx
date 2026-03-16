'use client'

import dynamic from 'next/dynamic'
import type { Feature } from '@/lib/types'

const FeaturesClient = dynamic(
  () => import('./FeaturesClient').then((m) => m.FeaturesClient),
  { ssr: false }
)

type Props = {
  projectId: string
  initialFeatures: Feature[]
  mapboxToken: string
  center: [number, number]
}

export function FeaturesWrapper(props: Props) {
  return <FeaturesClient {...props} />
}
