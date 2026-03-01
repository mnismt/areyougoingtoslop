import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'areyougoingslop',
  description:
    'how much of your github profile is ai slop? paste a username and find out.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  openGraph: {
    title: 'areyougoingslop',
    description:
      'how much of your github profile is ai slop? paste a username and find out.',
    images: ['/api/og/default'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'areyougoingslop',
    description:
      'how much of your github profile is ai slop? paste a username and find out.',
    images: ['/api/og/default'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TooltipProvider delayDuration={200}>
            <a href="#main-content" className="skip-link">
              Skip to content
            </a>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
