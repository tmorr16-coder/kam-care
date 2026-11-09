import type { Metadata, Viewport } from 'next'
import { Noto_Sans, Playfair_Display } from 'next/font/google'
import './globals.css'

const noto = Noto_Sans({ subsets: ['latin'], variable: '--font-noto', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'KAM Care', template: '%s · KAM Care' },
  description: 'The care platform for pastors, deacons and care leaders across Kingdom Apostolic Ministries.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#08325a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${noto.variable} ${playfair.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
