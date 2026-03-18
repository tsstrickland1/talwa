'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { UserPlus, Trash2, Shield, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OrganizationMember, OrganizationInvitation } from '@/lib/types'

type MemberWithUser = OrganizationMember & {
  user: {
    id: string
    name_first: string
    name_last: string
    email: string
    avatar: string | null
  }
}

export default function OrgMembersPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const orgId = params.id

  const [members, setMembers] = useState<MemberWithUser[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const [membersResult, invitationsResult] = await Promise.all([
      supabase
        .from('organization_members')
        .select('*, user:users(id, name_first, name_last, email, avatar)')
        .eq('creator_profile_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('organization_invitations')
        .select('*')
        .eq('creator_profile_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    setMembers((membersResult.data ?? []) as MemberWithUser[])
    setInvitations((invitationsResult.data ?? []) as OrganizationInvitation[])
  }, [orgId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setIsInviting(true)
    setError(null)

    const supabase = createClient()
    const { error: inviteError } = await supabase
      .from('organization_invitations')
      .insert({
        creator_profile_id: orgId,
        invitee_email: inviteEmail,
        role: inviteRole,
        status: 'pending',
        expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })

    if (inviteError) {
      setError(inviteError.message)
    } else {
      setInviteEmail('')
      await loadData()
    }
    setIsInviting(false)
  }

  async function handleRemoveMember(memberId: string) {
    const supabase = createClient()
    await supabase.from('organization_members').delete().eq('id', memberId)
    await loadData()
  }

  async function handleChangeRole(memberId: string, newRole: 'owner' | 'admin' | 'member') {
    const supabase = createClient()
    await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId)
    await loadData()
  }

  async function handleRevokeInvitation(invitationId: string) {
    const supabase = createClient()
    await supabase
      .from('organization_invitations')
      .update({ status: 'expired' })
      .eq('id', invitationId)
    await loadData()
  }

  const roleLabels: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  }

  const roleBadgeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
    owner: 'default',
    admin: 'secondary',
    member: 'outline',
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="font-heading text-3xl font-bold text-talwa-navy mb-6">
        Organization Members
      </h1>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {/* Invite form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" disabled={isInviting}>
              {isInviting ? 'Sending...' : 'Invite'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members list */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">
            Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => {
            const u = member.user
            const initials =
              `${u.name_first[0] ?? ''}${u.name_last[0] ?? ''}`.toUpperCase()
            const isCurrentUser = u.id === currentUserId
            const isOwner = member.role === 'owner'

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 py-2"
              >
                <Avatar className="h-9 w-9">
                  {u.avatar && (
                    <Image
                      src={u.avatar}
                      alt={initials}
                      fill
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {u.name_first} {u.name_last}
                    {isCurrentUser && (
                      <span className="text-muted-foreground ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email}
                  </p>
                </div>
                <Badge variant={roleBadgeVariants[member.role]}>
                  {roleLabels[member.role]}
                </Badge>
                {!isCurrentUser && !isOwner && (
                  <div className="flex gap-1">
                    {member.role === 'member' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleChangeRole(member.id, 'admin')}
                        title="Promote to admin"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                    )}
                    {member.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleChangeRole(member.id, 'member')}
                        title="Demote to member"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemoveMember(member.id)}
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Pending Invitations ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.invitee_email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited as {inv.role} &middot; Expires{' '}
                    {new Date(inv.expiration).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">Pending</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleRevokeInvitation(inv.id)}
                  title="Revoke invitation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
