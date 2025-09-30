'use client'

import './globals.css'
import Link from 'next/link'
import { useEffect } from 'react'
import { registerSW } from '@/lib/sw-register'
import OfflineBanner from '@/components/OfflineBanner'
import Bootstrap from '@/components/Bootstrap'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Register Workbox service worker on mount
  useEffect(() => { registerSW() }, [])

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#111827" />
        <link rel="icon" href="/icons/icon-192.png" />
        <title>Home Ops</title>
      </head>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {/* One-time local seeding for prefs/members/zones */}
        <Bootstrap />

        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
          <nav className="mx-auto max-w-screen-sm p-3 flex items-center gap-3 text-sm">
            <Link className="px-3 py-1 rounded-2xl hover:bg-gray-100" href="/today">Today</Link>
            <Link className="px-3 py-1 rounded-2xl hover:bg-gray-100" href="/chores">Chores</Link>
            <Link className="px-3 py-1 rounded-2xl hover:bg-gray-100" href="/meals">Meals</Link>
            <Link className="px-3 py-1 rounded-2xl hover:bg-gray-100" href="/grocery">Groceries</Link>
            <Link className="px-3 py-1 rounded-2xl hover:bg-gray-100" href="/print">Print</Link>
            <div className="flex-1" />
            <Link className="px-3 py-1 rounded-2xl hover:bg-gray-100" href="/settings">Settings</Link>
          </nav>
        </header>

        <main className="mx-auto max-w-screen-sm p-4">{children}</main>

        {/* Shows a little toast when the device goes offline */}
        <OfflineBanner />
      </body>
    </html>
  )
}
