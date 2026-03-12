'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nameFirst = formData.get('name_first') as string
  const nameLast = formData.get('name_last') as string
  const next = formData.get('next') as string | null

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${next ?? '/explore'}`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Update the users row with name fields (trigger only sets email + user_type)
  if (data.user) {
    const admin = createAdminClient()
    await admin
      .from('users')
      .update({ name_first: nameFirst, name_last: nameLast })
      .eq('id', data.user.id)
  }

  // If email confirmation is disabled, redirect directly
  if (data.session) {
    redirect(next ?? '/explore')
  }

  // Otherwise show confirmation message
  redirect('/signup/confirm')
}
