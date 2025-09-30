import './globals.css'
import Link from 'next/link'


export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<head>
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body className="min-h-screen bg-white text-gray-900 antialiased">
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
<Bootstrap />
</body>
</html>
)
}