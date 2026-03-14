import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SketchCard } from '@/components/cards/SketchCard'
import type { Sketch } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function SketchesPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [projectResult, sketchesResult] = await Promise.all([
    supabase.from('projects').select('name').eq('id', id).single(),
    supabase
      .from('sketches')
      .select('*, creator:users(name_first, name_last, avatar), feature:features(name)')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!projectResult.data) notFound()

  const sketches = (sketchesResult.data ?? []) as Array<
    Sketch & { creator: { name_first: string; name_last: string; avatar: string | null }; feature: { name: string } | null }
  >

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="font-heading text-2xl font-bold text-talwa-navy mb-2">
        Community Sketches
      </h1>
      <p className="text-talwa-navy/60 mb-6">
        AI-generated design concepts from community conversations.
      </p>

      {sketches.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">🎨</div>
          <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-2">
            No sketches yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Sketches are generated when contributors request design concepts during conversations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sketches.map((sketch) => (
            <SketchCard
              key={sketch.id}
              sketch={sketch}
              creator={sketch.creator}
              featureName={sketch.feature?.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}
