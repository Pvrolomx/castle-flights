import './globals.css'

export const metadata = {
  title: 'Castle Flights — Guest Flight Tracker',
  description: 'Real-time flight tracking for Castle Solutions property management. Puerto Vallarta, México.',
  icons: { icon: '/logo.png', apple: '/icon-192.png' },
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-castle-sand">{children}</body>
    </html>
  )
}
