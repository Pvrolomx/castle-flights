import './globals.css'

export const metadata = {
  title: 'Castle Flights — Guest Flight Tracker',
  description: 'Real-time flight tracking for Castle Solutions property management',
  manifest: '/manifest.json',
  themeColor: '#1A1A2E',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-castle-sand">{children}</body>
    </html>
  )
}
