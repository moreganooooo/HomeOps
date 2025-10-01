'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, startOfWeek } from 'date-fns'
import { db } from '@/lib/db'
import { SECTION_ORDER } from '@/lib/groceries'

export default function PrintGroceryPage(){
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<{ startOfWeek?: number } | null>(null)
  const [items, setItems] = useState<Array<{ id: string; name: string; qty: number; unit?: string; section?: string; weekStart: string }>>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const p = (await db.prefs.get('prefs')) || { startOfWeek: 1 }
      const sow = (p.startOfWeek ?? 1) as 0|1|2|3|4|5|6
      const ws = startOfWeek(now, { weekStartsOn: sow })
      const wsStr = format(ws, 'yyyy-MM-dd')
      const arr = await (db as any).groceries?.where?.('weekStart').equals(wsStr).toArray()
      if (mounted){ setPrefs(p); setItems(arr || []) }
    })().finally(()=> setLoading(false))
    return () => { mounted = false }
  }, [])

  const wsStr = useMemo(() => {
    const sow = (prefs?.startOfWeek ?? 1) as 0|1|2|3|4|5|6
    const ws = startOfWeek(now, { weekStartsOn: sow })
    return format(ws, 'yyyy-MM-dd')
  }, [prefs])

  const grouped = useMemo(() => {
    const map: Record<string, typeof items> = {}
    for (const it of items){
      const sec = it.section || 'Other'
      if (!map[sec]) map[sec] = []
      map[sec].push(it)
    }
    for (const k of Object.keys(map)) map[k] = map[k].sort((a,b)=> a.name.localeCompare(b.name))
    return map
  }, [items])

  if (loading) return <div className="p-6">Loading…</div>

  if (!items.length){
    return (
      <div className="p-6 print:p-4">
        <header className="mb-3">
          <h1 className="text-2xl font-extrabold">Grocery List</h1>
          <div className="text-sm text-gray-600">Week of {format(new Date(wsStr), 'EEE, MMM d')}</div>
          <div className="no-print mt-2"><Link href="/meals" className="card inline-block px-3 h-10">Generate via Sunday Prep</Link></div>
        </header>
        <p className="text-sm text-gray-600">No items yet for this week.</p>
      </div>
    )
  }

  return (
    <div className="p-6 print:p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">Grocery List</h1>
        <div className="text-sm text-gray-600">Week of {format(new Date(wsStr), 'EEE, MMM d')}</div>
        <div className="no-print mt-2 flex gap-2">
          <Link href="/grocery" className="card inline-flex items-center px-3 h-10">Back to Groceries</Link>
          <button className="card inline-flex items-center px-3 h-10" onClick={()=> window.print()}>Print</button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3">
        {SECTION_ORDER.filter(s => (grouped[s]?.length)).map(sec => (
          <section key={sec} className="break-inside-avoid-page">
            <h2 className="font-bold border-b pb-1 mb-2">{sec}</h2>
            <ul className="grid grid-cols-[auto_1fr_auto] items-start gap-y-1 gap-x-3">
              {grouped[sec].map((it) => (
                <li key={it.id} className="contents">
                  <span>□</span>
                  <span>{it.name}</span>
                  <span className="text-right text-gray-700">{it.qty} {it.unit || ''}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          body { font-size: 12pt; }
          h1 { font-size: 20pt }
          h2 { font-size: 14pt }
          .no-print { display: none !important }
        }
      `}</style>
    </div>
  )
}
