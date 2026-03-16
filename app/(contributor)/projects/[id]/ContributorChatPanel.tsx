'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRef, useCallback, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  MoreHorizontal,
  Clock,
  HelpCircle,
  PlusCircle,
  ArrowUp,
  Compass,
  PanelLeft,
  X,
} from 'lucide-react'
import { useFacilitator } from '@/hooks/useFacilitator'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { ThemeSurface } from '@/components/chat/ThemeSurface'
import { DataPointSurface } from '@/components/chat/DataPointSurface'
import { cn } from '@/lib/utils'
import type { Feature, Project } from '@/lib/types'

const ContributorMap = dynamic(
  () => import('@/components/map/ContributorMap').then((m) => m.ContributorMap),
  { ssr: false }
)

type Props = {
  project: Project
  features: Feature[]
  conversationId: string | null
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [hoveringMark, setHoveringMark] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)

  const isGuest = conversationId === null

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

  const guardedSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (isGuest) {
        setShowAuthGate(true)
        return
      }
      handleSubmit(e)
    },
    [isGuest, handleSubmit]
  )

  const guardedAppend = useCallback(
    (message: { role: 'user'; content: string }) => {
      if (isGuest) {
        setShowAuthGate(true)
        return
      }
      append(message)
    },
    [isGuest, append]
  )

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
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Left sidebar — collapsed icon strip */}
      <div
        className={cn(
          'flex flex-col shrink-0 border-r border-border bg-background transition-all duration-200 overflow-hidden z-20',
          sidebarExpanded ? 'w-52' : 'w-10'
        )}
      >
        {/* Brand mark / toggle button */}
        <button
          onClick={() => setSidebarExpanded((v: boolean) => !v)}
          onMouseEnter={() => setHoveringMark(true)}
          onMouseLeave={() => setHoveringMark(false)}
          className="flex items-center justify-center w-10 h-10 shrink-0 hover:bg-accent transition-colors"
          aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarExpanded ? (
            <X className="w-4 h-4 text-talwa-navy" />
          ) : hoveringMark ? (
            <PanelLeft className="w-5 h-5 text-talwa-teal" />
          ) : (
            <Image
              src="/brand/brand-mark.png"
              alt="Talwa"
              width={22}
              height={22}
              className="w-[22px] h-[22px] object-contain"
            />
          )}
        </button>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 pt-2 px-1">
          <Link
            href="/explore"
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:text-talwa-teal hover:bg-accent transition-colors',
              sidebarExpanded ? 'w-full' : 'w-8 justify-center'
            )}
            title="Explore"
          >
            <Compass className="w-5 h-5 shrink-0" />
            {sidebarExpanded && <span className="truncate">Explore</span>}
          </Link>
        </nav>
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
                      onClick={() => guardedAppend({ role: 'user', content: question })}
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
                hideInput
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
                {isGuest ? (
                  /* Guest CTA — clicking opens auth gate */
                  <button
                    onClick={() => setShowAuthGate(true)}
                    className="w-full flex items-center gap-2 bg-background rounded-full border border-input px-3 py-2 text-left hover:border-talwa-teal transition-colors"
                  >
                    <PlusCircle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                    <span className="flex-1 text-sm text-muted-foreground">
                      Join the conversation…
                    </span>
                  </button>
                ) : (
                  <form
                    onSubmit={guardedSubmit}
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
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auth gate modal */}
      {showAuthGate && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-talwa-navy/60 backdrop-blur-sm"
          onClick={() => setShowAuthGate(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src="/brand/brand-mark.png"
              alt="Talwa"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
            <div>
              <h2 className="font-heading text-xl font-bold text-talwa-navy mb-1">
                Join the conversation
              </h2>
              <p className="text-sm text-muted-foreground">
                Create a free account to share your thoughts and contribute to this project.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Link
                href={`/signup?next=/projects/${project.id}`}
                className="w-full rounded-full bg-talwa-teal text-white text-sm font-medium py-2.5 text-center hover:bg-talwa-teal/90 transition-colors"
              >
                Create account
              </Link>
              <Link
                href={`/login?next=/projects/${project.id}`}
                className="w-full rounded-full border border-border text-talwa-navy text-sm font-medium py-2.5 text-center hover:bg-accent transition-colors"
              >
                Sign in
              </Link>
            </div>
            <button
              onClick={() => setShowAuthGate(false)}
              className="text-xs text-muted-foreground hover:text-talwa-navy transition-colors"
            >
              Continue browsing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
