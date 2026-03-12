import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/explore')
  }

  return (
    <div className="min-h-screen bg-talwa-cream flex flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Link href="/">
              <Image
                src="/brand/lockup.png"
                alt="Talwa"
                width={120}
                height={60}
                className="h-14 w-auto"
              />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
