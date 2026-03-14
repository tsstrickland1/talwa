import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Feature } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default async function FeaturesPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()

  const [projectResult, featuresResult] = await Promise.all([
    admin.from('projects').select('name').eq('id', id).single(),
    admin.from('features').select('*').eq('project_id', id).order('created_at'),
  ])

  if (!projectResult.data) notFound()

  const features = (featuresResult.data ?? []) as Feature[]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-heading text-2xl font-bold text-talwa-navy mb-2">
        Map Features
      </h1>
      <p className="text-talwa-navy/60 mb-6">
        Define geographic features contributors can reference during conversations.
      </p>

      {features.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">🗺️</div>
          <h2 className="font-heading text-lg font-semibold text-talwa-navy mb-2">
            No features yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Features will appear here once you add them via the map editor.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-white hover:border-talwa-sky transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-talwa-navy">{feature.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {feature.type} · {feature.description || 'No description'}
                </p>
              </div>
              <span className="text-xs bg-talwa-sky/50 text-talwa-navy px-2 py-1 rounded-full capitalize">
                {feature.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
