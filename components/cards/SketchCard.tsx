'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Expand } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { Sketch, User } from '@/lib/types'

type SketchCardProps = {
  sketch: Sketch
  creator?: Pick<User, 'name_first' | 'name_last' | 'avatar'>
  featureName?: string
}

export function SketchCard({ sketch, creator, featureName }: SketchCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const initials = creator
    ? `${creator.name_first[0] ?? ''}${creator.name_last[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <>
      <div className="group relative overflow-hidden rounded-xl border border-border bg-card hover:shadow-md transition-all">
        <div
          className="relative aspect-square cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        >
          <Image
            src={sketch.image}
            alt={sketch.caption || 'Community sketch'}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Expand className="h-6 w-6 text-white drop-shadow" />
          </div>
        </div>

        <div className="p-3">
          {sketch.caption && (
            <p className="text-sm text-talwa-navy leading-snug mb-2">
              {sketch.caption}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {creator?.avatar && (
                <Image src={creator.avatar} alt={initials} fill className="object-cover" />
              )}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {creator && (
              <span className="text-xs text-muted-foreground">
                {creator.name_first} {creator.name_last}
              </span>
            )}
            {featureName && (
              <span className="text-xs text-muted-foreground ml-auto">{featureName}</span>
            )}
          </div>
        </div>
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-2">
          <div className="relative aspect-square w-full">
            <Image
              src={sketch.image}
              alt={sketch.caption || 'Community sketch'}
              fill
              className="object-contain"
            />
          </div>
          {sketch.caption && (
            <p className="text-sm text-center text-muted-foreground px-4 pb-2">
              {sketch.caption}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
