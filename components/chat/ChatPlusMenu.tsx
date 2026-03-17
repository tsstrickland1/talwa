'use client'

import { useRef, useCallback } from 'react'
import { PlusCircle, Camera, MapPin, Navigation, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Feature } from '@/lib/types'

interface ChatPlusMenuProps {
  features: Feature[]
  activeFeature: Feature | null
  disabled?: boolean
  onUseMyLocation: () => void
  onTagFeature: (feature: Feature) => void
  onPhotoSelected: (file: File) => void
  onVisualize: () => void
}

export function ChatPlusMenu({
  features,
  activeFeature,
  disabled = false,
  onUseMyLocation,
  onTagFeature,
  onPhotoSelected,
  onVisualize,
}: ChatPlusMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onPhotoSelected(file)
      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [onPhotoSelected]
  )

  const hasFeatures = features.length > 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="More options"
            className="shrink-0 text-muted-foreground/60 hover:text-talwa-teal transition-colors disabled:pointer-events-none disabled:opacity-40"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
          {/* Photo / file */}
          <DropdownMenuItem onSelect={handlePhotoClick} className="gap-2.5">
            <Camera className="w-4 h-4 text-muted-foreground" />
            <span>Photo / file</span>
          </DropdownMenuItem>

          {/* Tag a feature */}
          {hasFeatures ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>Tag a feature</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
                {features.map((feature) => (
                  <DropdownMenuItem
                    key={feature.id}
                    onSelect={() => onTagFeature(feature)}
                    className="gap-2"
                  >
                    <span className="truncate">{feature.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem disabled className="gap-2.5">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tag a feature</span>
            </DropdownMenuItem>
          )}

          {/* Use my location */}
          <DropdownMenuItem onSelect={onUseMyLocation} className="gap-2.5">
            <Navigation className="w-4 h-4 text-muted-foreground" />
            <span>Use my location</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Visualize — always available; workspace handles feature selection */}
          <DropdownMenuItem onSelect={onVisualize} className="gap-2.5">
            <Sparkles className="w-4 h-4 text-talwa-teal" />
            <span className="text-talwa-teal font-medium">Visualize</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  )
}
