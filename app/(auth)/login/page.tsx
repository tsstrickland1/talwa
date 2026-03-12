import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { loginWithEmail } from './actions'

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const next = params.next ?? '/explore'

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to continue to Talwa</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {params.error && (
          <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
            {params.error}
          </div>
        )}

        <form action={loginWithEmail} className="space-y-4">
          <input type="hidden" name="next" value={next} />

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
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href={`/signup${next !== '/explore' ? `?next=${next}` : ''}`}
            className="text-talwa-teal hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
