import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EPL Match Predictor',
  description: 'Predict Premier League match outcomes using machine learning',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

