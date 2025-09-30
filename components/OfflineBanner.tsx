'use client'
import { useEffect, useState } from 'react'
export default function OfflineBanner(){
const [offline, setOffline] = useState(false)
useEffect(() => {
const on = () => setOffline(false)
const off = () => setOffline(true)
setOffline(!navigator.onLine)
window.addEventListener('online', on)
window.addEventListener('offline', off)
return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
}, [])
if (!offline) return null
return (
<div className="no-print fixed bottom-3 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-2xl shadow">
Offline — changes will sync when back online
</div>
)
}