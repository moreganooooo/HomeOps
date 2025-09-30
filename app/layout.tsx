import './globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBoot from '@/components/ClientBoost'


export const metadata: Metadata = {
title: 'Home Ops',
manifest: '/manifest.webmanifest',
themeColor: '#111827',
icons: {
// Favicon is optional; add /favicon.ico if you have one
// icon: '/favicon.ico',
apple: [
{ url: '/apple-touch-icon.png', sizes: '180x180' },
// You can add more sizes if you provide them:
// { url: '/apple-touch-icon-167x167.png', sizes: '167x167' },
// { url: '/apple-touch-icon-152x152.png', sizes: '152x152' },
],
},
}


export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<body className="min-h-screen bg-white text-gray-900 antialiased">
{/* Client-only bootstrapping (SW register, offline banner, seed data) */}
<ClientBoot />


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
</body>
</html>
)}