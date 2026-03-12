'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginWithEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = formData.get('next') as string | null

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const params = new URLSearchParams({ error: error.message })
    if (next) params.set('next', next)
    redirect(`/login?${params.toString()}`)
  }

  redirect(next ?? '/explore')
}

export async function loginWithGoogle(formData: FormData) {
  const supabase = await createClient()
  const next = formData.get('next') as string | null

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${next ?? '/explore'}`,
    },
  })

  if (error || !data.url) {
    return { error: error?.message ?? 'OAuth failed' }
  }

  redirect(data.url)
}
