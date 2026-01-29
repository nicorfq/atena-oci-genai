import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Atena',
  description: 'Asistente virtual inteligente',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&family=Instrument+Serif&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
