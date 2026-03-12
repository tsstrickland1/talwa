'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Map,
  Users,
  MessageSquare,
  ImageIcon,
  Megaphone,
  Settings,
  BarChart3,
  ChevronDown,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { User, Project } from '@/lib/types'

type CreatorNavProps = {
  user: User
  project?: Project
  projects?: Project[]
}

const projectNavItems = (projectId: string) => [
  {
    label: 'Insights',
    href: `/projects/${projectId}/insights`,
    icon: BarChart3,
  },
  {
    label: 'Features',
    href: `/projects/${projectId}/features`,
    icon: Map,
  },
  {
    label: 'Contributors',
    href: `/projects/${projectId}/contributors`,
    icon: Users,
  },
  {
    label: 'Conversations',
    href: `/projects/${projectId}/conversations`,
    icon: MessageSquare,
  },
  {
    label: 'Sketches',
    href: `/projects/${projectId}/sketches`,
    icon: ImageIcon,
  },
  {
    label: 'Updates',
    href: `/projects/${projectId}/updates`,
    icon: Megaphone,
  },
  {
    label: 'Configure',
    href: `/projects/${projectId}/configure`,
    icon: Settings,
  },
]

export function CreatorNav({ user, project, projects = [] }: CreatorNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = `${user.name_first[0] ?? ''}${user.name_last[0] ?? ''}`.toUpperCase()
  const navItems = project ? projectNavItems(project.id) : []

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/dashboard">
          <Image
            src="/brand/lockup-horizontal.png"
            alt="Talwa"
            width={90}
            height={24}
            className="h-6 w-auto"
          />
        </Link>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto py-3 px-2">
        {/* Dashboard link */}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 mb-1"
          asChild
        >
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>

        {/* Project switcher */}
        {project && (
          <>
            <Separator className="my-2" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-between gap-2 mb-2 h-auto py-2 px-3"
                >
                  <span className="text-left leading-tight text-xs font-medium truncate">
                    {project.name}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {projects.map((p) => (
                  <DropdownMenuItem key={p.id} asChild>
                    <Link href={`/projects/${p.id}/insights`}>
                      {p.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem asChild>
                  <Link href="/projects/new">+ New project</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Project nav items */}
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'justify-start gap-2',
                      isActive && 'text-talwa-teal font-medium'
                    )}
                    asChild
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                )
              })}
            </nav>
          </>
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {user.avatar && (
              <Image src={user.avatar} alt={initials} fill className="object-cover" />
            )}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {user.name_first} {user.name_last}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
