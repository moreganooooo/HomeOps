'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { format, startOfWeek } from 'date-fns'
import { db } from '@/lib/db'

export default function PrintGroceryPage(){
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<GroceryItem[]>([])
  const [prefs, setPrefs] = useState<{ startOfWeek?: number } | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const p = (await db.prefs.get('prefs')) || { startOfWeek: 1 }
      const sow = (p.startOfWeek ?? 1) as 0|1|2|3|4|5|6
      const ws = startOfWeek(now, { weekStartsOn: sow })
      const wsStr = format(ws, 'yyyy-MM-dd')
      try {
        const arr = await (db as any).groceries?.where?.('weekStart').equals(wsStr).toArray()
        if (mounted){ setPrefs(p); setItems(arr || []) }
      } finally { mounted && setLoading(false) }
    })()
    return () => { mounted = false }
  }, [])

  const wsStr = useMemo(() => {
    const sow = (prefs?.startOfWeek ?? 1) as 0|1|2|3|4|5|6
    const ws = startOfWeek(now, { weekStartsOn: sow })
    return format(ws, 'yyyy-MM-dd')
  }, [prefs])

  const grouped = useMemo(() => groupBySection(items), [items])

  if (loading) return <div className="p-6">Loading…</div>

  return (
    <div className="p-6 print:p-2">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">Grocery List</h1>
        <div className="text-sm text-gray-600">Week of {format(new Date(wsStr), 'EEE, MMM d')}</div>
        <button className="card h-10 px-3 mt-2 no-print" onClick={() => window.print()}>Print</button>
      </header>

      {SECTION_ORDER.filter(s => grouped[s]?.length).map(section => (
        <section key={section} className="mb-4 break-inside-avoid-page">
          <div className="font-semibold border-b pb-1 mb-2">{section}</div>
          <ul className="grid grid-cols-1 gap-1">
            {grouped[section].map(it => (
              <li key={it.id} className="text-base">
                ☐ {it.name} — {it.qty} {it.unit||''}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <style jsx global>{`
        @media print{ .no-print{ display: none } body{ color: #000; } }
      `}</style>
    </div>
  )
}

// shared helpers
function groupBySection(items: GroceryItem[]): Record<string, GroceryItem[]>{
  const map: Record<string, GroceryItem[]> = {}
  for (const it of items){
    const sec = (it.section || 'Other') as string
    if (!map[sec]) map[sec] = []
    map[sec].push(it)
  }
  for (const sec of Object.keys(map)){
    map[sec] = map[sec].sort((a,b)=> a.name.localeCompare(b.name))
  }
  return map
}

type GroceryItem = { id: string; weekStart: string; name: string; qty: number; unit?: string; section?: string; checked?: boolean }

const SECTION_ORDER = ['Produce','Meat','Dairy','Bakery','Pantry','Frozen','Household','Other'] as const
