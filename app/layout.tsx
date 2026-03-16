import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Talwa — Community Engagement',
  description: 'Place-based community engagement powered by AI. Share your perspective on local projects and spaces.',
  openGraph: {
    title: 'Talwa — Community Engagement',
    description: 'Place-based community engagement powered by AI.',
    images: ['/brand/social-image.jpg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Talwa — Community Engagement',
    description: 'Place-based community engagement powered by AI.',
    images: ['/brand/social-image.jpg'],
  },
  icons: {
    icon: '/brand/brand-mark.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
