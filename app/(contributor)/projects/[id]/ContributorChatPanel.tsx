'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRef, useCallback } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  MoreHorizontal,
  MapPin,
  Clock,
  HelpCircle,
  PlusCircle,
  ArrowUp,
} from 'lucide-react'
import { useFacilitator } from '@/hooks/useFacilitator'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { ThemeSurface } from '@/components/chat/ThemeSurface'
import { DataPointSurface } from '@/components/chat/DataPointSurface'
import type { Feature, Project } from '@/lib/types'

const ContributorMap = dynamic(
  () => import('@/components/map/ContributorMap').then((m) => m.ContributorMap),
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
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    activePin,
    surfacedContent,
    historyLoaded,
    pinLocation,
    clearSurface,
    append,
  } = useFacilitator({
    projectId: project.id,
    conversationId,
  })

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const form = textareaRef.current?.closest('form')
        if (form && input.trim()) {
          form.requestSubmit()
        }
      }
    },
    [input]
  )

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const center: [number, number] = [-73.9857, 40.7484]
  const hasMessages = messages.length > 0

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left sidebar */}
      <div className="flex flex-col items-center w-10 shrink-0 border-r border-border py-3 gap-4">
        <Image
          src="/brand/brand-mark.png"
          alt="Talwa"
          width={24}
          height={24}
          className="w-6 h-6 object-contain"
        />
        <MapPin className="w-5 h-5 text-muted-foreground/40" />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center h-12 px-4 border-b border-border shrink-0 bg-background">
          <button
            onClick={() => router.back()}
            className="mr-3 text-talwa-navy hover:text-talwa-teal transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-semibold text-talwa-navy text-lg flex-1 truncate">
            {project.name}
          </h1>
          <button
            className="text-muted-foreground hover:text-talwa-navy transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Map + Chat row */}
        <div className="flex flex-1 min-h-0">
          {/* Map panel */}
          <div className="hidden md:block w-[53%] shrink-0 border-r border-border">
            <ContributorMap
              mapboxToken={mapboxToken}
              center={center}
              features={features}
              activePin={activePin}
              onFeatureClick={(feature) => {
                pinLocation({ lat: 0, lng: 0 }, feature)
              }}
              onMapClick={(location) => {
                pinLocation(location, undefined)
              }}
              className="h-full"
            />
          </div>

          {/* Chat panel */}
          <div className="flex flex-col flex-1 min-w-0 bg-talwa-cream">
            {/* History icon */}
            <div className="flex justify-end px-4 pt-3 pb-1 shrink-0">
              <button
                className="text-muted-foreground/50 hover:text-talwa-navy transition-colors"
                aria-label="Conversation history"
              >
                <Clock className="w-4 h-4" />
              </button>
            </div>

            {!historyLoaded ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm text-muted-foreground">Loading conversation…</span>
              </div>
            ) : !hasMessages ? (
              /* Topic selection empty state */
              <div className="flex-1 overflow-y-auto px-6 py-2">
                <h2 className="font-heading text-xl font-semibold text-talwa-navy mb-5">
                  What would you like to discuss?
                </h2>
                <div className="flex flex-col gap-4">
                  {project.dialogue_framework.map((question) => (
                    <button
                      key={question}
                      onClick={() => append({ role: 'user', content: question })}
                      className="flex items-center gap-3 text-left text-talwa-navy hover:text-talwa-teal transition-colors group"
                    >
                      <HelpCircle className="w-5 h-5 text-muted-foreground/50 shrink-0 group-hover:text-talwa-teal/60 transition-colors" />
                      <span className="text-sm leading-snug">{question}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message list */
              <ChatContainer
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                placeholder="Ask me something …"
                className="flex-1 min-h-0"
                bottomSlot={
                  surfacedContent?.type === 'theme' ? (
                    <ThemeSurface theme={null} onDismiss={clearSurface} />
                  ) : surfacedContent?.type === 'data_point' ? (
                    <DataPointSurface dataPoint={null} onDismiss={clearSurface} />
                  ) : null
                }
              />
            )}

            {/* Chat input — always shown once history is loaded */}
            {historyLoaded && (
              <div className="shrink-0 border-t border-border bg-talwa-cream px-4 py-3">
                <form
                  onSubmit={handleSubmit as (e: FormEvent<HTMLFormElement>) => void}
                  className="flex items-center gap-2 bg-background rounded-full border border-input px-3 py-2"
                >
                  <PlusCircle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onInput={handleTextareaInput}
                    placeholder="Ask me something …"
                    disabled={isLoading}
                    rows={1}
                    className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground text-talwa-navy min-h-[20px] max-h-28 overflow-y-auto"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="w-8 h-8 rounded-full bg-talwa-teal flex items-center justify-center text-white disabled:opacity-40 shrink-0 transition-opacity"
                    aria-label="Send"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
