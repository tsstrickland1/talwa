import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .limit(3)

  return NextResponse.json({
    auth: { userId: user?.id ?? null, error: authError?.message ?? null },
    query: { data, error },
  })
}
