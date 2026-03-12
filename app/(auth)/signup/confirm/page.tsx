import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SignUpConfirmPage() {
  return (
    <Card className="text-center">
      <CardHeader>
        <div className="text-4xl mb-2">📬</div>
        <CardTitle className="text-xl">Check your email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a confirmation link to your email address. Click the link
          to activate your account and get started.
        </p>
        <Button variant="outline" asChild className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
