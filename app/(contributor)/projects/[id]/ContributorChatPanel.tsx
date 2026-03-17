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
  Share2,
  Info,
  Menu,
  Map as MapIcon,
  MessageSquare,
  Copy,
  Check,
  Pencil,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFacilitator, computeCentroid } from '@/hooks/useFacilitator'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { ThemeSurface } from '@/components/chat/ThemeSurface'
import { DataPointSurface } from '@/components/chat/DataPointSurface'
import { DrawFeatureModal } from '@/components/map/DrawFeatureModal'
import { cn } from '@/lib/utils'
import type { Feature, FeatureGeoJSON, FeatureType, Project, User } from '@/lib/types'
import type { ContributorMapHandle } from '@/components/map/ContributorMap'

const ContributorMap = dynamic(
  () => import('@/components/map/ContributorMap').then((m) => m.ContributorMap),
  { ssr: false }
)

type CreatorSummary = Pick<User, 'id' | 'name_first' | 'name_last' | 'avatar'>

type Props = {
  project: Project
  features: Feature[]
  conversationId: string | null
  userId: string | null
  mapboxToken: string
  creator?: CreatorSummary | null
}

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  path: 'Path / Street',
  park: 'Park / Green Space',
  plaza: 'Plaza / Square',
  landmark: 'Landmark',
  other: 'Other',
}

const FEATURE_TYPES = Object.entries(FEATURE_TYPE_LABELS) as [FeatureType, string][]

export function ContributorChatPanel({
  project,
  features: initialFeatures,
  conversationId,
  userId,
  mapboxToken,
  creator,
}: Props) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mapRef = useRef<ContributorMapHandle>(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [hoveringMark, setHoveringMark] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileChatView, setMobileChatView] = useState<'chat' | 'map'>('chat')
  const [chatView, setChatView] = useState<'chat' | 'share' | 'about'>('chat')
  const [copied, setCopied] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [featuresState, setFeaturesState] = useState<Feature[]>(initialFeatures)
  const [pendingGeoJSON, setPendingGeoJSON] = useState<FeatureGeoJSON | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [isEditingFeature, setIsEditingFeature] = useState(false)
  const [editingGeometry, setEditingGeometry] = useState<FeatureGeoJSON | null>(null)

  const isGuest = conversationId === null

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    activePin,
    activeFeature,
    surfacedContent,
    historyLoaded,
    pinLocation,
    clearPin,
    clearSurface,
    append,
    activateDrawnFeature,
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

  const handleFeatureDraw = useCallback((geojson: FeatureGeoJSON) => {
    setPendingGeoJSON(geojson)
  }, [])

  const handleDrawSave = useCallback((feature: Feature) => {
    setFeaturesState((prev) => [...prev, feature])
    mapRef.current?.addFeatureLayer(feature)
    activateDrawnFeature(feature)
    setPendingGeoJSON(null)
  }, [activateDrawnFeature])

  const handleDrawCancel = useCallback(() => {
    mapRef.current?.cancelDraw()
    setPendingGeoJSON(null)
  }, [])

  const handleFeatureSelect = useCallback((feature: Feature) => {
    const geojson: FeatureGeoJSON =
      typeof feature.geojson === 'string'
        ? (JSON.parse(feature.geojson) as FeatureGeoJSON)
        : (feature.geojson as unknown as FeatureGeoJSON)
    pinLocation(computeCentroid(geojson), feature)
    setSelectedFeature(feature)
    setIsEditingFeature(false)
    setEditingGeometry(null)
  }, [pinLocation])

  const handleFeatureDismiss = useCallback(() => {
    clearPin()
    setSelectedFeature(null)
    setIsEditingFeature(false)
    setEditingGeometry(null)
  }, [clearPin])

  const handleEditStart = useCallback(() => {
    if (!selectedFeature) return
    setIsEditingFeature(true)
    setEditingGeometry(null)
    mapRef.current?.startEditGeometry(selectedFeature)
  }, [selectedFeature])

  const handleEditCancel = useCallback(() => {
    if (selectedFeature) {
      mapRef.current?.stopEditGeometry(selectedFeature.id)
    }
    setIsEditingFeature(false)
    setEditingGeometry(null)
  }, [selectedFeature])

  const handleEditSave = useCallback(async (
    featureId: string,
    updates: { name: string; type: FeatureType; description: string }
  ) => {
    const body: Record<string, unknown> = { ...updates }
    if (editingGeometry) body.geojson = editingGeometry

    mapRef.current?.stopEditGeometry(featureId)

    const res = await fetch(`/api/features?id=${featureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return

    const updated = await res.json() as Feature

    setFeaturesState((prev) => prev.map((f) => (f.id === featureId ? updated : f)))

    if (editingGeometry) {
      mapRef.current?.removeFeatureLayer(featureId)
      setTimeout(() => mapRef.current?.addFeatureLayer(updated), 50)
    }

    setSelectedFeature(updated)
    setIsEditingFeature(false)
    setEditingGeometry(null)
  }, [editingGeometry])

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const center: [number, number] = [-73.9857, 40.7484]
  const hasMessages = messages.length > 0

  // Shared nav items used in both desktop sidebar and mobile drawer
  const navItems = (onClick?: () => void) => (
    <nav className="flex flex-col gap-1 pt-2 px-1">
      <Link
        href="/explore"
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:text-talwa-teal hover:bg-accent transition-colors',
          sidebarExpanded ? 'w-full' : 'w-8 justify-center'
        )}
        title="Explore"
      >
        <Compass className="w-5 h-5 shrink-0" />
        {(sidebarExpanded || onClick) && <span className="truncate">Explore</span>}
      </Link>
    </nav>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* ── Desktop sidebar — absolute overlay (z-30 over map) ── */}
      <div
        className={cn(
          'hidden md:flex flex-col absolute left-0 top-0 h-full z-30 border-r border-border bg-background transition-all duration-200',
          sidebarExpanded ? 'w-52' : 'w-10'
        )}
      >
        {/* Toggle area */}
        {sidebarExpanded ? (
          /* Expanded: brand mark left + collapse button right */
          <div className="flex items-center h-10 px-1 shrink-0">
            <Image
              src="/brand/brand-mark.png"
              alt="Talwa"
              width={22}
              height={22}
              className="w-[22px] h-[22px] object-contain ml-1"
            />
            <button
              onClick={() => setSidebarExpanded(false)}
              className="ml-auto p-1.5 rounded hover:bg-accent transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeft className="w-4 h-4 text-talwa-navy" />
            </button>
          </div>
        ) : (
          /* Collapsed: full-area button — brand mark default, PanelLeft on hover */
          <button
            onClick={() => setSidebarExpanded(true)}
            onMouseEnter={() => setHoveringMark(true)}
            onMouseLeave={() => setHoveringMark(false)}
            className="flex items-center justify-center w-10 h-10 shrink-0 hover:bg-accent transition-colors"
            aria-label="Expand sidebar"
          >
            {hoveringMark ? (
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
        )}

        {navItems()}
      </div>

      {/* ── Mobile drawer overlay (z-50) ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden absolute inset-0 z-50 bg-talwa-navy/40"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute left-0 top-0 h-full w-56 bg-background border-r border-border flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center h-10 px-3 border-b border-border shrink-0">
              <Image
                src="/brand/brand-mark.png"
                alt="Talwa"
                width={22}
                height={22}
                className="w-[22px] h-[22px] object-contain"
              />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="ml-auto p-1 rounded hover:bg-accent transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4 text-talwa-navy" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 pt-2 px-1">
              <Link
                href="/explore"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:text-talwa-teal hover:bg-accent transition-colors"
              >
                <Compass className="w-5 h-5 shrink-0" />
                <span>Explore</span>
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* ── Main content — pl-10 on desktop leaves room for collapsed sidebar strip ── */}
      <div className="flex flex-col flex-1 min-w-0 md:pl-10">
        {/* Header */}
        <div className="flex items-center h-12 px-4 border-b border-border shrink-0 bg-background">
          {/* Mobile: hamburger */}
          <button
            className="md:hidden mr-2 text-muted-foreground hover:text-talwa-navy transition-colors"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted-foreground hover:text-talwa-navy transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => setChatView('share')}
                className="flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setChatView('about')}
                className="flex items-center gap-2"
              >
                <Info className="w-4 h-4" />
                About
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Map + Chat row */}
        <div className="flex flex-1 min-h-0">
          {/* Map panel — hidden on mobile unless mobileChatView === 'map' */}
          <div
            className={cn(
              'md:relative md:inset-auto md:z-auto md:w-[53%] md:shrink-0 md:border-r md:border-border',
              mobileChatView === 'map'
                ? 'fixed inset-0 z-40'
                : 'hidden md:block'
            )}
          >
            <ContributorMap
              ref={mapRef}
              mapboxToken={mapboxToken}
              center={center}
              features={featuresState}
              activePin={activePin}
              activeFeature={activeFeature}
              drawingEnabled={!isGuest}
              onFeatureClick={handleFeatureSelect}
              onMapClick={(location) => {
                setSelectedFeature(null)
                setIsEditingFeature(false)
                setEditingGeometry(null)
                pinLocation(location, undefined)
              }}
              onFeatureDraw={handleFeatureDraw}
              onGeometryUpdate={setEditingGeometry}
              className="h-full"
            />
            <DrawFeatureModal
              open={pendingGeoJSON !== null}
              projectId={project.id}
              geojson={pendingGeoJSON}
              onSave={handleDrawSave}
              onCancel={handleDrawCancel}
            />
            {/* Feature detail / edit panel */}
            {selectedFeature && (
              <FeatureDetailOverlay
                feature={selectedFeature}
                isEditing={isEditingFeature}
                editingGeometry={editingGeometry}
                canEdit={userId !== null && userId === selectedFeature.creator_id}
                onDismiss={handleFeatureDismiss}
                onEditStart={handleEditStart}
                onEditCancel={handleEditCancel}
                onEditSave={handleEditSave}
              />
            )}
            {/* Mobile: back to chat button overlaid on map */}
            {mobileChatView === 'map' && (
              <button
                className="md:hidden absolute top-3 right-3 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-xs font-medium text-talwa-navy shadow-sm flex items-center gap-1.5 hover:bg-background transition-colors"
                onClick={() => setMobileChatView('chat')}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </button>
            )}
          </div>

          {/* Chat / Share / About panel */}
          <div
            className={cn(
              'flex flex-col flex-1 min-w-0',
              mobileChatView === 'map' ? 'hidden md:flex' : 'flex'
            )}
          >
            {chatView === 'share' ? (
              /* ── Share pane ── */
              <div className="flex flex-col flex-1 bg-talwa-cream">
                <div className="flex items-center gap-3 px-4 h-11 border-b border-border shrink-0 bg-background">
                  <button
                    onClick={() => setChatView('chat')}
                    className="text-muted-foreground hover:text-talwa-navy transition-colors"
                    aria-label="Back to chat"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-talwa-navy">Share</span>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Project link
                    </p>
                    <div className="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2.5">
                      <span className="text-sm text-talwa-navy flex-1 truncate">
                        {typeof window !== 'undefined' ? window.location.href : ''}
                      </span>
                      <button
                        onClick={handleCopyLink}
                        className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-talwa-teal hover:text-talwa-teal/80 transition-colors"
                        aria-label="Copy link"
                      >
                        {copied ? (
                          <><Check className="w-3.5 h-3.5" />Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" />Copy</>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Share message
                    </p>
                    <div className="bg-background rounded-lg border border-border px-3 py-2.5">
                      <p className="text-sm text-talwa-navy leading-relaxed">
                        {`Check out "${project.name}" on Talwa — a community engagement project near ${project.location}. Share your perspective and help shape the design.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : chatView === 'about' ? (
              /* ── About pane ── */
              <div className="flex flex-col flex-1 bg-talwa-cream">
                <div className="flex items-center gap-3 px-4 h-11 border-b border-border shrink-0 bg-background">
                  <button
                    onClick={() => setChatView('chat')}
                    className="text-muted-foreground hover:text-talwa-navy transition-colors"
                    aria-label="Back to chat"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-talwa-navy">About</span>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
                  {/* Featured image */}
                  {project.featured_image && (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden shrink-0">
                      <Image
                        src={project.featured_image}
                        alt={project.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}

                  {/* Project name + location */}
                  <div>
                    <h2 className="font-heading text-xl font-bold text-talwa-navy leading-tight">
                      {project.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{project.location}</p>
                  </div>

                  {/* Creator */}
                  {creator && (
                    <Link
                      href={`/creators/${creator.id}`}
                      className="flex items-center gap-2 text-sm text-talwa-teal hover:underline w-fit"
                    >
                      {creator.avatar ? (
                        <Image
                          src={creator.avatar}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded-full w-5 h-5 object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: '#C7EDFA', color: '#0A4F66' }}
                        >
                          {(creator.name_first.charAt(0) + creator.name_last.charAt(0)).toUpperCase() || '?'}
                        </div>
                      )}
                      {[creator.name_first, creator.name_last].filter(Boolean).join(' ') || 'Project Creator'}
                    </Link>
                  )}

                  {/* Status badge */}
                  {project.status && (
                    <span
                      className="inline-block rounded-full px-3 py-1 text-xs font-medium capitalize"
                      style={{ backgroundColor: '#DBD894', color: '#031D25' }}
                    >
                      {project.status}
                    </span>
                  )}

                  {/* Description */}
                  <p className="text-sm text-talwa-navy leading-relaxed">
                    {project.long_description || project.short_description}
                  </p>
                </div>
              </div>
            ) : (
              /* ── Chat pane ── */
              <div className="flex flex-col flex-1 min-h-0 bg-talwa-cream">
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowAuthGate(true)}
                          className="flex-1 flex items-center gap-2 bg-background rounded-full border border-input px-3 py-2 text-left hover:border-talwa-teal transition-colors"
                        >
                          <PlusCircle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                          <span className="flex-1 text-sm text-muted-foreground">
                            Join the conversation…
                          </span>
                        </button>
                        {/* Mobile: map toggle */}
                        <button
                          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full border border-input bg-background text-muted-foreground hover:text-talwa-teal transition-colors shrink-0"
                          onClick={() => setMobileChatView('map')}
                          aria-label="Show map"
                        >
                          <MapIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <form
                          onSubmit={guardedSubmit}
                          className="flex-1 flex items-center gap-2 bg-background rounded-full border border-input px-3 py-2"
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
                        {/* Mobile: map toggle */}
                        <button
                          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full border border-input bg-background text-muted-foreground hover:text-talwa-teal transition-colors shrink-0"
                          onClick={() => setMobileChatView('map')}
                          aria-label="Show map"
                        >
                          <MapIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
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

/* ── Feature detail / edit overlay ── */

type FeatureDetailOverlayProps = {
  feature: Feature
  isEditing: boolean
  editingGeometry: FeatureGeoJSON | null
  canEdit: boolean
  onDismiss: () => void
  onEditStart: () => void
  onEditCancel: () => void
  onEditSave: (featureId: string, updates: { name: string; type: FeatureType; description: string }) => void
}

function FeatureDetailOverlay({
  feature,
  isEditing,
  editingGeometry,
  canEdit,
  onDismiss,
  onEditStart,
  onEditCancel,
  onEditSave,
}: FeatureDetailOverlayProps) {
  const [editName, setEditName] = useState(feature.name)
  const [editType, setEditType] = useState<FeatureType>(feature.type)
  const [editDescription, setEditDescription] = useState(feature.description)
  const [saving, setSaving] = useState(false)

  // Sync form fields when the feature changes (e.g. after save returns updated data)
  const featureId = feature.id
  const prevFeatureIdRef = useRef(featureId)
  if (prevFeatureIdRef.current !== featureId) {
    prevFeatureIdRef.current = featureId
    setEditName(feature.name)
    setEditType(feature.type)
    setEditDescription(feature.description)
  }

  async function handleSave() {
    setSaving(true)
    await onEditSave(feature.id, { name: editName, type: editType, description: editDescription })
    setSaving(false)
  }

  if (isEditing) {
    return (
      <div className="absolute bottom-4 left-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-talwa-sky p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edit feature</span>
          {editingGeometry && (
            <span className="text-[10px] font-medium text-talwa-teal bg-talwa-sky rounded-full px-2 py-0.5">
              Geometry updated
            </span>
          )}
        </div>

        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Feature name"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy outline-none focus:border-talwa-teal transition-colors"
        />

        <select
          value={editType}
          onChange={(e) => setEditType(e.target.value as FeatureType)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy outline-none focus:border-talwa-teal transition-colors"
        >
          {FEATURE_TYPES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-talwa-navy outline-none resize-none focus:border-talwa-teal transition-colors"
        />

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !editName.trim()}
            className="flex-1 rounded-full bg-talwa-teal text-white text-sm font-medium py-2 hover:bg-talwa-teal/90 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onEditCancel}
            className="flex-1 rounded-full border border-border text-talwa-navy text-sm font-medium py-2 hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-talwa-sky p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-talwa-navy text-sm leading-tight truncate">
            {feature.name}
          </h3>
          <span className="inline-block mt-1 rounded-full bg-talwa-sky px-2 py-0.5 text-[10px] font-medium text-talwa-teal capitalize">
            {FEATURE_TYPE_LABELS[feature.type] ?? feature.type}
          </span>
          {feature.description && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {feature.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <button
              onClick={onEditStart}
              className="p-1.5 rounded-md text-muted-foreground hover:text-talwa-teal hover:bg-accent transition-colors"
              aria-label="Edit feature"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-md text-muted-foreground hover:text-talwa-navy hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
