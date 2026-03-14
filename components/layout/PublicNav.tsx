import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center px-6 md:px-10">
        <Link href="/explore" className="flex items-center shrink-0">
          <Image
            src="/brand/lockup-horizontal.png"
            alt="Talwa"
            width={110}
            height={30}
            className="h-8 w-auto"
          />
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-talwa-navy hover:text-talwa-teal transition-colors"
          >
            Login
          </Link>
          <Button
            asChild
            className="bg-talwa-olive hover:bg-talwa-olive/90 text-white rounded-md text-sm font-medium"
          >
            <Link href="/signup">Start a Project</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
