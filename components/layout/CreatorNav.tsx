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
  Building2,
  UserCircle,
  Plus,
  Menu,
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
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import type { User, Project, CreatorProfile } from '@/lib/types'

type CreatorNavProps = {
  user: User
  projects?: Project[]
  creatorProfiles?: CreatorProfile[]
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

export function CreatorNav({ user, projects = [], creatorProfiles = [] }: CreatorNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = `${user.name_first[0] ?? ''}${user.name_last[0] ?? ''}`.toUpperCase()

  // Derive current project from pathname so project nav items always appear on project routes
  const projectIdFromPath = pathname.match(/\/projects\/([^/]+)/)?.[1]
  const currentProject = projects.find((p) => p.id === projectIdFromPath)
  const navItems = currentProject ? projectNavItems(currentProject.id) : []

  const navContent = (onNavClick?: () => void) => (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4 shrink-0">
        <Link href="/dashboard" onClick={onNavClick}>
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
          onClick={onNavClick}
        >
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>

        {/* Creator profiles / organizations */}
        {creatorProfiles.length > 0 && (
          <>
            <Separator className="my-2" />
            <p className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Profiles
            </p>
            {creatorProfiles.map((cp) => (
              <Button
                key={cp.id}
                variant="ghost"
                size="sm"
                className="justify-start gap-2 h-auto py-1.5"
                asChild
                onClick={onNavClick}
              >
                <Link href={cp.type === 'organization' ? `/organizations/${cp.id}` : '/dashboard'}>
                  {cp.type === 'organization' ? (
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <UserCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="text-xs truncate">{cp.name}</span>
                </Link>
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2 text-muted-foreground"
              asChild
              onClick={onNavClick}
            >
              <Link href="/organizations/new">
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">New organization</span>
              </Link>
            </Button>
          </>
        )}

        {/* Project switcher */}
        {currentProject && (
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
                    {currentProject.name}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {projects.map((p) => (
                  <DropdownMenuItem key={p.id} asChild>
                    <Link href={`/projects/${p.id}/insights`} onClick={onNavClick}>
                      {p.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem asChild>
                  <Link href="/projects/new" onClick={onNavClick}>+ New project</Link>
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
                    onClick={onNavClick}
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
      <div className="border-t border-border p-3 shrink-0">
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
    </>
  )

  return (
    <>
      {/* Mobile: sticky top header bar */}
      <div className="flex md:hidden items-center justify-between h-14 px-4 border-b border-border bg-background shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/dashboard">
          <Image
            src="/brand/lockup-horizontal.png"
            alt="Talwa"
            width={90}
            height={24}
            className="h-6 w-auto"
          />
        </Link>
        <Avatar className="h-8 w-8">
          {user.avatar && (
            <Image src={user.avatar} alt={initials} fill className="object-cover" />
          )}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>

      {/* Mobile: Sheet drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          {navContent(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Desktop: sidebar */}
      <aside className="hidden md:flex h-full w-60 flex-col border-r border-border bg-background">
        {navContent()}
      </aside>
    </>
  )
}
