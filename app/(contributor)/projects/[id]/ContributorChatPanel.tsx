'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRef, useCallback, useState, useMemo } from 'react'
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
  Minimize2,
  Maximize2,
  ChevronDown,
  Loader2,
  FileText,
  Lightbulb,
  LogOut,
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
import { ChatPlusMenu } from '@/components/chat/ChatPlusMenu'
import { TagFeaturePrompt } from '@/components/chat/TagFeaturePrompt'
import { SketchWorkspace } from '@/components/chat/SketchWizard'
import { DrawFeatureModal } from '@/components/map/DrawFeatureModal'
import { NavUserMenu } from '@/components/layout/NavUserMenu'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { DataPoint, Feature, FeatureGeoJSON, FeatureType, Project, Sketch, Theme, User } from '@/lib/types'
import type { ContributorMapHandle } from '@/components/map/ContributorMap'

const ContributorMap = dynamic(
  () => import('@/components/map/ContributorMap').then((m) => m.ContributorMap),
  { ssr: false }
)

type CreatorSummary = Pick<User, 'id' | 'name_first' | 'name_last' | 'avatar'>

type Props = {
  project: Project
  features: Feature[]
  themes: Theme[]
  dataPoints: DataPoint[]
  conversationId: string | null
  userId: string | null
  mapboxToken: string
  creator?: CreatorSummary | null
  currentUser?: User | null
}

type FeaturePanelState = 'closed' | 'open' | 'minimized' | 'expanded'

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  path: 'Path / Street',
  park: 'Park / Green Space',
  plaza: 'Plaza / Square',
  landmark: 'Landmark',
  other: 'Other',
}

const FEATURE_TYPES = Object.entries(FEATURE_TYPE_LABELS) as [FeatureType, string][]

type PendingAttachment = {
  id: string
  type: 'image' | 'document'
  name: string
  mimeType: string
  uploading: boolean
  // image
  url?: string
  storagePath?: string
  // document
  openaiFileId?: string
}

function getFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/svg+xml': 'SVG',
    'application/pdf': 'PDF',
    'text/plain': 'TXT',
    'text/markdown': 'MD',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'text/csv': 'CSV',
    'text/html': 'HTML',
    'application/json': 'JSON',
  }
  return map[mimeType] ?? mimeType.split('/')[1]?.toUpperCase() ?? 'FILE'
}

export function ContributorChatPanel({
  project,
  features: initialFeatures,
  themes,
  dataPoints,
  conversationId,
  userId,
  mapboxToken,
  creator,
  currentUser,
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
  const [featurePanelState, setFeaturePanelState] = useState<FeaturePanelState>('closed')
  const [featureSketches, setFeatureSketches] = useState<Sketch[]>([])
  const [sketchesLoading, setSketchesLoading] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [vectorStoreId, setVectorStoreId] = useState<string | null>(null)
  const [sketchWorkspaceOpen, setSketchWorkspaceOpen] = useState(false)
  const [pendingVisualize, setPendingVisualize] = useState(false)
  const [featureTagMode, setFeatureTagMode] = useState(false)
  const [pendingTagFeature, setPendingTagFeature] = useState(false)

  const isGuest = conversationId === null

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const {
    messages,
    input,
    setInput,
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
    insightsMode,
    toggleInsightsMode,
  } = useFacilitator({
    projectId: project.id,
    conversationId,
    vectorStoreId,
  })

  // Compute data points to highlight on map when a theme is surfaced
  const highlightedDataPoints = useMemo(() => {
    if (surfacedContent?.type !== 'theme') return []
    return dataPoints.filter((dp) => dp.theme_ids.includes(surfacedContent.theme_id))
  }, [surfacedContent, dataPoints])

  // Resolve the surfaced theme object for the ThemeSurface card
  const surfacedTheme = useMemo(() => {
    if (surfacedContent?.type !== 'theme') return null
    return themes.find((t) => t.id === surfacedContent.theme_id) ?? null
  }, [surfacedContent, themes])

  const guardedSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (isGuest) {
        setShowAuthGate(true)
        return
      }
      const readyImages = pendingAttachments.filter(
        (a): a is PendingAttachment & { type: 'image'; url: string } =>
          a.type === 'image' && !a.uploading && !!a.url
      )
      if (readyImages.length > 0) {
        const text = input.trim() || '(shared files)'
        // AI SDK useChat types content as string, but runtime + streamText support
        // array content for multi-modal messages — cast is safe here.
        append({
          role: 'user',
          content: [
            ...readyImages.map((img) => ({ type: 'image', image: img.url })),
            { type: 'text', text },
          ],
        } as unknown as Parameters<typeof append>[0])
        setInput('')
        setPendingAttachments([])
        return
      }
      // Documents are already in the vector store; just clear the pending chips and send.
      setPendingAttachments([])
      handleSubmit(e)
    },
    [isGuest, handleSubmit, pendingAttachments, input, append, setInput]
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
    setFeaturesState((prev: Feature[]) => [...prev, feature])
    mapRef.current?.addFeatureLayer(feature)
    activateDrawnFeature(feature)
    setPendingGeoJSON(null)
    if (pendingVisualize) {
      setPendingVisualize(false)
      setSketchWorkspaceOpen(true)
      setMobileChatView('chat')
    }
    if (pendingTagFeature) {
      setPendingTagFeature(false)
      setMobileChatView('chat')
    }
  }, [activateDrawnFeature, pendingVisualize, pendingTagFeature])

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
    setFeaturePanelState('open')
    setFeatureSketches([])
    // Fly after a tick so the panel has begun rendering (ResizeObserver fires map.resize)
    setTimeout(() => mapRef.current?.flyToFeature(feature), 60)
    // If the visualization workspace is open, switch back to chat so the user
    // can see the selected feature reflected in the workspace's feature_select step
    if (sketchWorkspaceOpen) setMobileChatView('chat')
    // If in tag-feature mode, the selection completes the action — return to chat
    if (featureTagMode) {
      setFeatureTagMode(false)
      setMobileChatView('chat')
    }
  }, [pinLocation, sketchWorkspaceOpen, featureTagMode])

  const handleFeatureDismiss = useCallback(() => {
    clearPin()
    setSelectedFeature(null)
    setIsEditingFeature(false)
    setEditingGeometry(null)
    setFeaturePanelState('closed')
    setFeatureSketches([])
  }, [clearPin])

  const handleThemeClick = useCallback(
    (theme: Theme) => {
      if (isGuest) {
        setShowAuthGate(true)
        return
      }
      append({
        role: 'user',
        content: `Tell me more about the community theme "${theme.name}".`,
      })
    },
    [isGuest, append]
  )

  const handleEditStart = useCallback(() => {
    if (!selectedFeature) return
    // If currently expanded, return to open state so map is visible for geometry editing
    if (featurePanelState === 'expanded') setFeaturePanelState('open')
    setIsEditingFeature(true)
    setEditingGeometry(null)
    mapRef.current?.startEditGeometry(selectedFeature)
  }, [selectedFeature, featurePanelState])

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

  const handlePanelMinimize = useCallback(() => {
    setFeaturePanelState('minimized')
  }, [])

  const handlePanelExpand = useCallback(async () => {
    setFeaturePanelState('expanded')
    if (!selectedFeature || featureSketches.length > 0) return
    setSketchesLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('sketches')
      .select('*')
      .eq('feature_id', selectedFeature.id)
    setFeatureSketches((data as Sketch[]) ?? [])
    setSketchesLoading(false)
  }, [selectedFeature, featureSketches.length])

  const handlePanelBackToMap = useCallback(() => {
    setFeaturePanelState('open')
    setMobileChatView('map')
    setTimeout(() => {
      if (selectedFeature) mapRef.current?.flyToFeature(selectedFeature)
    }, 60)
  }, [selectedFeature])

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pinLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        alert('Unable to retrieve your location. Please check your browser permissions.')
      }
    )
  }, [pinLocation])

  const handleTagFeature = useCallback(() => {
    setFeatureTagMode(true)
  }, [])

  const handleTagDrawNewFeature = useCallback(() => {
    setFeatureTagMode(false)
    setPendingTagFeature(true)
    setMobileChatView('map')
  }, [])

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (!conversationId) return
      // Cap at 10 total
      const available = 10 - pendingAttachments.length
      const filesToAdd = files.slice(0, available)
      if (filesToAdd.length === 0) return

      // Add placeholders immediately so spinners appear right away
      const placeholders: PendingAttachment[] = filesToAdd.map((file) => ({
        id: crypto.randomUUID(),
        type: file.type.startsWith('image/') ? 'image' : 'document',
        name: file.name,
        mimeType: file.type,
        uploading: true,
      }))
      setPendingAttachments((prev) => [...prev, ...placeholders])

      // Upload each file in parallel
      await Promise.all(
        filesToAdd.map(async (file, idx) => {
          const placeholder = placeholders[idx]
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('conversation_id', conversationId)
            const res = await fetch('/api/facilitator/upload', { method: 'POST', body: formData })
            if (!res.ok) throw new Error('Upload failed')

            if (placeholder.type === 'image') {
              const data = await res.json() as { type: 'image'; url: string; storagePath: string }
              setPendingAttachments((prev) =>
                prev.map((a) =>
                  a.id === placeholder.id
                    ? { ...a, uploading: false, url: data.url, storagePath: data.storagePath }
                    : a
                )
              )
            } else {
              const data = await res.json() as { type: 'document'; name: string; vectorStoreId: string; fileId: string }
              setVectorStoreId(data.vectorStoreId)
              setPendingAttachments((prev) =>
                prev.map((a) =>
                  a.id === placeholder.id
                    ? { ...a, uploading: false, openaiFileId: data.fileId }
                    : a
                )
              )
            }
          } catch (err) {
            console.error('Upload failed:', err)
            // Remove the failed placeholder
            setPendingAttachments((prev) => prev.filter((a) => a.id !== placeholder.id))
          }
        })
      )
    },
    [conversationId, pendingAttachments.length]
  )

  const handleRemoveAttachment = useCallback(
    async (id: string) => {
      const attachment = pendingAttachments.find((a) => a.id === id)
      if (!attachment) return
      // Remove from UI immediately
      setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
      // Fire-and-forget delete on the server
      if (attachment.type === 'image' && attachment.storagePath) {
        fetch('/api/facilitator/attachment', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'image', storagePath: attachment.storagePath }),
        }).catch((err) => console.error('Failed to delete image from storage:', err))
      } else if (attachment.type === 'document' && attachment.openaiFileId && vectorStoreId) {
        fetch('/api/facilitator/attachment', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'document', vectorStoreId, fileId: attachment.openaiFileId }),
        }).catch((err) => console.error('Failed to delete document from vector store:', err))
      }
    },
    [pendingAttachments, vectorStoreId]
  )

  const handleOpenSketchWorkspace = useCallback(() => {
    setSketchWorkspaceOpen(true)
  }, [])

  const handleSketchGoToMap = useCallback(() => {
    setMobileChatView('map')
  }, [])

  const handleDrawNewFeature = useCallback(() => {
    setSketchWorkspaceOpen(false)
    setPendingVisualize(true)
    setMobileChatView('map')
  }, [])

  const handleSketchPublished = useCallback((sketch: Sketch) => {
    setFeatureSketches((prev: Sketch[]) => [sketch, ...prev])
  }, [])

  const center: [number, number] =
    project.lng != null && project.lat != null
      ? [project.lng, project.lat]
      : [-73.9857, 40.7484]
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
            {currentUser && (
              <div className="mt-auto border-t border-border px-3 py-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-talwa-navy truncate">
                    {currentUser.name_first} {currentUser.name_last}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-talwa-navy shrink-0"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
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
          {currentUser && <NavUserMenu user={currentUser} />}
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
          {/* ── Map column — hidden on mobile unless map view, or when expanded on desktop ── */}
          <div
            className={cn(
              'flex flex-col md:border-r md:border-border',
              // Desktop: flex-1 (takes ~2/3), hidden when expanded (replaced below)
              featurePanelState === 'expanded'
                ? 'hidden'
                : 'md:flex-1 md:shrink-0',
              // Mobile
              mobileChatView === 'map'
                ? 'flex flex-col fixed inset-0 z-40 md:relative md:inset-auto md:z-auto'
                : 'hidden md:flex'
            )}
          >
            {/* Map fills remaining height above the panel */}
            <div className="flex-1 min-h-0 relative">
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
                  setFeaturePanelState('closed')
                  pinLocation(location, undefined)
                }}
                onFeatureDraw={handleFeatureDraw}
                onGeometryUpdate={setEditingGeometry}
                highlightedDataPoints={highlightedDataPoints}
                className="h-full"
              />
              <DrawFeatureModal
                open={pendingGeoJSON !== null}
                projectId={project.id}
                geojson={pendingGeoJSON}
                onSave={handleDrawSave}
                onCancel={handleDrawCancel}
              />
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

            {/* Feature detail panel — open or minimized states */}
            {selectedFeature && (featurePanelState === 'open' || featurePanelState === 'minimized') && (
              <FeatureDetailPanel
                feature={selectedFeature}
                state={featurePanelState}
                isEditing={isEditingFeature}
                editingGeometry={editingGeometry}
                canEdit={userId !== null && userId === selectedFeature.creator_id}
                onMinimize={handlePanelMinimize}
                onExpand={handlePanelExpand}
                onDismiss={handleFeatureDismiss}
                onEditStart={handleEditStart}
                onEditCancel={handleEditCancel}
                onEditSave={handleEditSave}
                featureThemes={themes.filter((t) =>
                  dataPoints.some(
                    (dp) => dp.feature_id === selectedFeature.id && dp.theme_ids.includes(t.id)
                  )
                )}
                onThemeClick={handleThemeClick}
              />
            )}
          </div>

          {/* ── Expanded feature detail — replaces map column on desktop ── */}
          {featurePanelState === 'expanded' && selectedFeature && (
            <div className="hidden md:flex flex-col flex-1 shrink-0 border-r border-border overflow-hidden">
              <FeatureDetailExpanded
                feature={selectedFeature}
                sketches={featureSketches}
                sketchesLoading={sketchesLoading}
                canEdit={userId !== null && userId === selectedFeature.creator_id}
                onBackToMap={handlePanelBackToMap}
                onDismiss={handleFeatureDismiss}
                onEditStart={handleEditStart}
              />
            </div>
          )}

          {/* Mobile expanded feature detail — full-screen overlay */}
          {featurePanelState === 'expanded' && selectedFeature && (
            <div className="md:hidden fixed inset-0 z-40 flex flex-col">
              <FeatureDetailExpanded
                feature={selectedFeature}
                sketches={featureSketches}
                sketchesLoading={sketchesLoading}
                canEdit={userId !== null && userId === selectedFeature.creator_id}
                onBackToMap={handlePanelBackToMap}
                onDismiss={handleFeatureDismiss}
                onEditStart={handleEditStart}
              />
            </div>
          )}

          {/* ── Chat / Share / About panel ── */}
          <div
            className={cn(
              'flex flex-col min-w-0 md:w-1/3 md:min-w-[300px] md:shrink-0 md:flex-none',
              mobileChatView === 'map' ? 'hidden md:flex' : 'flex flex-1'
            )}
          >
            {chatView === 'share' ? (
              /* ── Share pane ── */
              <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-talwa-cream">
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
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Project link
                    </p>
                    <div className="flex items-center gap-2 min-w-0 bg-background rounded-lg border border-border px-3 py-2.5">
                      <span className="text-sm text-talwa-navy flex-1 truncate min-w-0">
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
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Share message
                    </p>
                    <div className="bg-background rounded-lg border border-border px-3 py-2.5">
                      <p className="text-sm text-talwa-navy leading-relaxed break-words">
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
                {/* Chat toolbar */}
                <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-1 shrink-0">
                  {/* Explore insights toggle */}
                  {themes.length > 0 && !isGuest && (
                    <button
                      onClick={toggleInsightsMode}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                        insightsMode
                          ? 'bg-talwa-olive-light/40 text-talwa-olive-black'
                          : 'text-muted-foreground/60 hover:text-talwa-navy hover:bg-muted/50'
                      )}
                      aria-label="Toggle explore insights"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Insights</span>
                    </button>
                  )}
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
                      sketchWorkspaceOpen && conversationId ? (
                        <SketchWorkspace
                          activeFeature={activeFeature}
                          projectId={project.id}
                          conversationId={conversationId}
                          onClose={() => setSketchWorkspaceOpen(false)}
                          onGoToMap={handleSketchGoToMap}
                          onDrawNewFeature={handleDrawNewFeature}
                          onPublished={handleSketchPublished}
                        />
                      ) : surfacedContent?.type === 'theme' ? (
                        <ThemeSurface
                          theme={surfacedTheme}
                          dataPoints={highlightedDataPoints}
                          onDismiss={clearSurface}
                        />
                      ) : surfacedContent?.type === 'data_point' ? (
                        <DataPointSurface dataPoint={null} onDismiss={clearSurface} />
                      ) : null
                    }
                  />
                )}

                {/* Chat input — always shown once history is loaded */}
                {historyLoaded && (
                  <div className="shrink-0 border-t border-border bg-talwa-cream px-4 py-3 flex flex-col gap-2">
                    {featureTagMode && !isGuest && (
                      <TagFeaturePrompt
                        activeFeature={activeFeature}
                        onGoToMap={() => setMobileChatView('map')}
                        onDrawNewFeature={handleTagDrawNewFeature}
                        onConfirm={() => setFeatureTagMode(false)}
                        onDismiss={() => setFeatureTagMode(false)}
                      />
                    )}
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
                          className="flex-1 flex flex-col bg-background rounded-2xl border border-input px-3 py-2 gap-2"
                        >
                          {/* Pending attachments — horizontal scroll row */}
                          {pendingAttachments.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                              {pendingAttachments.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className="relative flex flex-col w-24 shrink-0 rounded-md border border-border bg-muted overflow-hidden"
                                >
                                  {/* Thumbnail or icon area */}
                                  <div className="relative w-full h-14 flex items-center justify-center bg-muted">
                                    {attachment.uploading ? (
                                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    ) : attachment.type === 'image' && attachment.url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={attachment.url}
                                        alt={attachment.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <FileText className="w-6 h-6 text-talwa-teal" />
                                    )}
                                    {/* File type badge */}
                                    <span className="absolute bottom-0.5 left-0.5 text-[9px] font-semibold px-1 rounded bg-talwa-navy/70 text-white leading-tight">
                                      {getFileTypeLabel(attachment.mimeType)}
                                    </span>
                                    {/* Remove button */}
                                    {!attachment.uploading && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAttachment(attachment.id)}
                                        aria-label="Remove attachment"
                                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-talwa-navy/70 flex items-center justify-center text-white hover:bg-talwa-navy transition-colors"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                  {/* Filename */}
                                  <div className="px-1.5 py-1">
                                    <p className="text-[10px] text-muted-foreground truncate leading-tight">
                                      {attachment.name}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <ChatPlusMenu
                              disabled={isLoading || pendingAttachments.some((a) => a.uploading)}
                              onUseMyLocation={handleUseMyLocation}
                              onTagFeature={handleTagFeature}
                              onFileSelected={handleFileSelected}
                              onVisualize={handleOpenSketchWorkspace}
                            />
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
                              disabled={
                                isLoading ||
                                pendingAttachments.some((a) => a.uploading) ||
                                (!input.trim() && pendingAttachments.filter((a) => !a.uploading).length === 0)
                              }
                              className="w-8 h-8 rounded-full bg-talwa-teal flex items-center justify-center text-white disabled:opacity-40 shrink-0 transition-opacity"
                              aria-label="Send"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                          </div>
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

/* ── Feature detail panel (open + minimized states) ── */

type FeatureDetailPanelProps = {
  feature: Feature
  state: 'open' | 'minimized'
  isEditing: boolean
  editingGeometry: FeatureGeoJSON | null
  canEdit: boolean
  onMinimize: () => void
  onExpand: () => void
  onDismiss: () => void
  onEditStart: () => void
  onEditCancel: () => void
  onEditSave: (featureId: string, updates: { name: string; type: FeatureType; description: string }) => void
  featureThemes?: Theme[]
  onThemeClick?: (theme: Theme) => void
}

function FeatureDetailPanel({
  feature,
  state,
  isEditing,
  editingGeometry,
  canEdit,
  onMinimize,
  onExpand,
  onDismiss,
  onEditStart,
  onEditCancel,
  onEditSave,
  featureThemes = [],
  onThemeClick,
}: FeatureDetailPanelProps) {
  const [editName, setEditName] = useState(feature.name)
  const [editType, setEditType] = useState<FeatureType>(feature.type)
  const [editDescription, setEditDescription] = useState(feature.description)
  const [saving, setSaving] = useState(false)

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

  /* Minimized strip */
  if (state === 'minimized') {
    return (
      <div className="shrink-0 h-10 border-t border-talwa-sky bg-background flex items-center gap-2 px-3">
        <span className="flex-1 text-sm font-medium text-talwa-navy truncate">{feature.name}</span>
        <span className="rounded-full bg-talwa-sky px-2 py-0.5 text-[10px] font-medium text-talwa-teal capitalize hidden sm:inline">
          {FEATURE_TYPE_LABELS[feature.type] ?? feature.type}
        </span>
        <button
          onClick={onExpand}
          className="p-1.5 rounded-md text-muted-foreground hover:text-talwa-teal hover:bg-accent transition-colors"
          aria-label="Expand feature detail"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-md text-muted-foreground hover:text-talwa-navy hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  /* Open state — edit form */
  if (isEditing) {
    return (
      <div className="shrink-0 border-t border-talwa-sky bg-white/95 backdrop-blur-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edit feature</span>
          <div className="flex items-center gap-1">
            {editingGeometry && (
              <span className="text-[10px] font-medium text-talwa-teal bg-talwa-sky rounded-full px-2 py-0.5">
                Geometry updated
              </span>
            )}
          </div>
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

  /* Open state — detail view */
  return (
    <div className="shrink-0 border-t border-talwa-sky bg-white/95 backdrop-blur-sm">
      {/* Header row */}
      <div className="flex items-start gap-2 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-talwa-navy text-sm leading-tight truncate">
            {feature.name}
          </h3>
          <span className="inline-block mt-1 rounded-full bg-talwa-sky px-2 py-0.5 text-[10px] font-medium text-talwa-teal capitalize">
            {FEATURE_TYPE_LABELS[feature.type] ?? feature.type}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <button
            onClick={onMinimize}
            className="p-1.5 rounded-md text-muted-foreground hover:text-talwa-teal hover:bg-accent transition-colors"
            aria-label="Minimize"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onExpand}
            className="p-1.5 rounded-md text-muted-foreground hover:text-talwa-teal hover:bg-accent transition-colors"
            aria-label="Expand to full view"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
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

      {/* Description */}
      {feature.description && (
        <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {feature.description}
        </p>
      )}

      {/* Associated themes */}
      {featureThemes.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {featureThemes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onThemeClick?.(theme)}
              className="inline-flex items-center gap-1 rounded-full bg-talwa-sky/60 px-2.5 py-1 text-[11px] font-medium text-talwa-teal hover:bg-talwa-sky transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              {theme.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Feature detail expanded (replaces map column) ── */

type FeatureDetailExpandedProps = {
  feature: Feature
  sketches: Sketch[]
  sketchesLoading: boolean
  canEdit: boolean
  onBackToMap: () => void
  onDismiss: () => void
  onEditStart: () => void
}

function FeatureDetailExpanded({
  feature,
  sketches,
  sketchesLoading,
  canEdit,
  onBackToMap,
  onDismiss,
  onEditStart,
}: FeatureDetailExpandedProps) {
  return (
    <div className="flex flex-col h-full bg-talwa-cream">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0 bg-background">
        <button
          onClick={onBackToMap}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-talwa-teal transition-colors shrink-0"
          aria-label="Back to map"
        >
          <Minimize2 className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Map</span>
        </button>
        <h2 className="flex-1 font-heading font-semibold text-talwa-navy text-sm truncate ml-2">
          {feature.name}
        </h2>
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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Type + description */}
        <div>
          <span className="inline-block rounded-full bg-talwa-sky px-2.5 py-0.5 text-xs font-medium text-talwa-teal capitalize">
            {FEATURE_TYPE_LABELS[feature.type] ?? feature.type}
          </span>
          {feature.description && (
            <p className="mt-3 text-sm text-talwa-navy leading-relaxed">
              {feature.description}
            </p>
          )}
        </div>

        {/* Sketches */}
        <div>
          <h3 className="font-heading text-base font-semibold text-talwa-navy mb-3">Sketches</h3>
          {sketchesLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-video rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : sketches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sketches yet for this feature.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {sketches.map((sketch) => (
                <div key={sketch.id} className="rounded-lg overflow-hidden border border-border bg-background">
                  {sketch.image ? (
                    <div className="relative aspect-video">
                      <Image
                        src={sketch.image}
                        alt={sketch.caption || 'Sketch'}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}
                  {sketch.caption && (
                    <p className="px-2.5 py-2 text-xs text-talwa-navy leading-snug">
                      {sketch.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
