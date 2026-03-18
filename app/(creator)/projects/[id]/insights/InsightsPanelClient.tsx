'use client'

import dynamic from 'next/dynamic'
import { useAnalyst } from '@/hooks/useAnalyst'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { ThemeCard } from '@/components/cards/ThemeCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Project, Feature, Theme, DataPoint } from '@/lib/types'

const InsightsMap = dynamic(
  () => import('@/components/map/InsightsMap').then((m) => m.InsightsMap),
  { ssr: false }
)

type Props = {
  project: Project
  features: Feature[]
  themes: Theme[]
  dataPoints: DataPoint[]
  mapboxToken: string
}

export function InsightsPanelClient({
  project,
  features,
  themes,
  dataPoints,
  mapboxToken,
}: Props) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    selectedThemeId,
    selectTheme,
  } = useAnalyst({ projectId: project.id })

  const center: [number, number] =
    project.lng != null && project.lat != null
      ? [project.lng, project.lat]
      : [-73.9857, 40.7484]

  const themeDataPointCounts = themes.reduce(
    (acc, theme) => {
      acc[theme.id] = dataPoints.filter((dp) =>
        dp.theme_ids.includes(theme.id)
      ).length
      return acc
    },
    {} as Record<string, number>
  )

  const themesList = (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-3">
        Themes ({themes.length})
      </h2>
      {themes.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No themes yet. Themes are generated automatically as contributors engage.
        </div>
      ) : (
        <div className="grid gap-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              dataPointCount={themeDataPointCounts[theme.id] ?? 0}
              isSelected={selectedThemeId === theme.id}
              onClick={() => selectTheme(theme.id)}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile: tab layout (below 768px) */}
      <div className="flex flex-col md:hidden h-[calc(100vh-3.5rem)]">
        <Tabs defaultValue="map" className="flex flex-col h-full">
          <TabsList className="shrink-0 w-full rounded-none border-b border-border bg-background justify-start px-4 gap-1 h-10">
            <TabsTrigger value="map" className="text-xs">Map</TabsTrigger>
            <TabsTrigger value="themes" className="text-xs">Themes</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">Chat</TabsTrigger>
          </TabsList>
          <TabsContent value="map" className="flex-1 mt-0 overflow-hidden">
            <InsightsMap
              mapboxToken={mapboxToken}
              center={center}
              features={features}
              dataPoints={dataPoints}
              selectedThemeId={selectedThemeId}
              className="h-full"
            />
          </TabsContent>
          <TabsContent value="themes" className="flex-1 mt-0 overflow-hidden flex flex-col">
            {themesList}
          </TabsContent>
          <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
            <ChatContainer
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              placeholder="Ask about your community's feedback…"
              className="h-full"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: split layout (768px and above) */}
      <div className="hidden md:flex h-screen">
        {/* Left: Map + Themes */}
        <div className="w-1/2 border-r border-border flex flex-col">
          <div className="h-1/2 border-b border-border">
            <InsightsMap
              mapboxToken={mapboxToken}
              center={center}
              features={features}
              dataPoints={dataPoints}
              selectedThemeId={selectedThemeId}
              className="h-full"
            />
          </div>
          {themesList}
        </div>

        {/* Right: Analyst Chat */}
        <div className="w-1/2">
          <div className="border-b border-border p-4">
            <h2 className="font-heading text-base font-semibold text-talwa-navy">
              Insights Analyst
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ask questions about what your community is saying
            </p>
          </div>
          <div className="h-[calc(100vh-5.5rem)]">
            <ChatContainer
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              placeholder="Ask about your community's feedback…"
              className="h-full"
            />
          </div>
        </div>
      </div>
    </>
  )
}
