import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { signUp } from './actions'

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>
}

export default async function SignUpPage({ searchParams }: Props) {
  const params = await searchParams
  const next = params.next ?? '/explore'

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Join the community on Talwa</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {params.error && (
          <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
            {params.error}
          </div>
        )}
        <form action={signUp} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name_first">First name</Label>
              <Input
                id="name_first"
                name="name_first"
                type="text"
                placeholder="Alex"
                required
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_last">Last name</Label>
              <Input
                id="name_last"
                name="name_last"
                type="text"
                placeholder="Chen"
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-talwa-teal hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
