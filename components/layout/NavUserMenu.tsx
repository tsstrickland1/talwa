'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/types'

type Props = {
  user: User
}

export function NavUserMenu({ user }: Props) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = `${user.name_first[0] ?? ''}${user.name_last[0] ?? ''}`.toUpperCase()
  const isCreator = user.user_type === 'project_creator' || user.user_type === 'admin'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            {user.avatar && (
              <Image src={user.avatar} alt={initials} fill className="object-cover" />
            )}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user.name_first} {user.name_last}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        {isCreator && (
          <DropdownMenuItem asChild>
            <a href="/dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Creator Dashboard
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
