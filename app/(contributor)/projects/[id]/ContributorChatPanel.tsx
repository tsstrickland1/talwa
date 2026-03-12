'use client'

import dynamic from 'next/dynamic'
import { useFacilitator } from '@/hooks/useFacilitator'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { ThemeSurface } from '@/components/chat/ThemeSurface'
import { DataPointSurface } from '@/components/chat/DataPointSurface'
import type { Feature, Project } from '@/lib/types'

// Map component loaded client-side only to avoid SSR issues
const ContributorMap = dynamic(
  () =>
    import('@/components/map/ContributorMap').then((m) => m.ContributorMap),
  { ssr: false }
)

type Props = {
  project: Project
  features: Feature[]
  conversationId: string
  mapboxToken: string
}

export function ContributorChatPanel({
  project,
  features,
  conversationId,
  mapboxToken,
}: Props) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    activePin,
    activeFeature,
    surfacedContent,
    pinLocation,
    clearSurface,
  } = useFacilitator({
    projectId: project.id,
    conversationId,
  })

  const center: [number, number] = [-73.9857, 40.7484] // Default NYC; ideally derived from project.location

  return (
    <div className="flex h-full">
      {/* Map — 40% */}
      <div className="hidden md:block w-2/5 border-r border-border">
        <ContributorMap
          mapboxToken={mapboxToken}
          center={center}
          features={features}
          activePin={activePin}
          onFeatureClick={(feature) => {
            pinLocation({ lat: 0, lng: 0 }, feature) // Use feature centroid ideally
          }}
          onMapClick={(location) => {
            const nearestFeature = features.find(() => true) // Simplified; real logic uses proximity
            pinLocation(location, nearestFeature)
          }}
          className="h-full"
        />
      </div>

      {/* Chat — 60% */}
      <div className="flex-1 min-w-0">
        <ChatContainer
          messages={messages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Share your thoughts about this project…"
          className="h-full"
          bottomSlot={
            surfacedContent?.type === 'theme' ? (
              <ThemeSurface
                theme={null}
                onDismiss={clearSurface}
              />
            ) : surfacedContent?.type === 'data_point' ? (
              <DataPointSurface dataPoint={null} onDismiss={clearSurface} />
            ) : null
          }
        />
      </div>
    </div>
  )
}
