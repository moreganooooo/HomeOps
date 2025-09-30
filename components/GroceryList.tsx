// components/GroceryList.tsx
'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, startOfWeek } from 'date-fns'
import { db } from '@/lib/db'

type GroceryItem = { id: string; weekStart: string; name: string; qty: number; unit?: string; section?: string; checked?: boolean }
const SECTION_ORDER = ['Produce','Meat','Dairy','Bakery','Pantry','Frozen','Household','Other'] as const

export default function GroceryList(){
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<GroceryItem[]>([])
  const [prefs, setPrefs] = useState<{ startOfWeek?: number } | null>(null)
  const [name, setName] = useState('')
  const [qty, setQty] = useState<number | ''>('')
  const [unit, setUnit] = useState('')
  const [section, setSection] = useState('Produce')

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

  async function toggle(id: string, checked: boolean){
    const it = items.find(i => i.id === id)
    if (!it) return
    const updated = { ...it, checked }
    await (db as any).groceries?.put?.(updated)
    setItems(prev => prev.map(p => p.id === id ? updated : p))
  }

  async function addItem(){
    if (!name.trim()) return
    const id = `groc-${wsStr}-${crypto.randomUUID()}`
    const newItem: GroceryItem = { id, weekStart: wsStr, name: name.trim(), qty: Number(qty||1), unit: unit||undefined, section, checked: false }
    await (db as any).groceries?.put?.(newItem)
    setItems(prev => [...prev, newItem])
    setName(''); setQty(''); setUnit(''); setSection('Produce')
  }

  async function uncheckAll(){
    const updated = items.map(i => ({ ...i, checked: false }))
    await Promise.all(updated.map(u => (db as any).groceries?.put?.(u)))
    setItems(updated)
  }

  if (loading) return <div className="card">Loading…</div>

  if (!items.length){
    return (
      <div className="card">
        <h2 className="text-xl font-extrabold">Groceries</h2>
        <p className="text-sm text-gray-600 mt-1">No items yet for this week. Run the Sunday Prep wizard to generate a list.</p>
        <Link href="/meals" className="primary mt-3 flex items-center justify-center">Open Sunday Prep</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Groceries</h1>
        <div className="flex items-center gap-2">
          <Link href="/print/grocery" className="card h-10 px-3 flex items-center">Print</Link>
          <button className="card h-10 px-3" onClick={uncheckAll}>Uncheck All</button>
        </div>
      </header>
      <div className="text-sm text-gray-600">Week of {format(new Date(wsStr), 'EEE, MMM d')}</div>

      {/* Quick Add */}
      <div className="card">
        <div className="font-semibold">Quick add</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input aria-label="Item name" value={name} onChange={e=> setName(e.target.value)} placeholder="Item" className="h-12 rounded-2xl border px-3"/>
          <input aria-label="Quantity" value={qty} onChange={e=> setQty(e.target.value ? Number(e.target.value) : '')} placeholder="Qty" type="number" className="h-12 rounded-2xl border px-3"/>
          <input aria-label="Unit" value={unit} onChange={e=> setUnit(e.target.value)} placeholder="Unit" className="h-12 rounded-2xl border px-3"/>
          <select aria-label="Section" value={section} onChange={e=> setSection(e.target.value)} className="h-12 rounded-2xl border px-3">
            {SECTION_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="primary mt-2" onClick={addItem}>Add Item</button>
      </div>

      {/* Sections */}
      {SECTION_ORDER.filter(s => grouped[s]?.length).map(section => (
        <section key={section} className="card">
          <div className="font-semibold mb-2">{section}</div>
          <ul className="space-y-2">
            {grouped[section].map(it => (
              <li key={it.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-6 w-6 rounded border-gray-300"
                  checked={Boolean(it.checked)}
                  onChange={e=> toggle(it.id, e.currentTarget.checked)}
                  aria-label={`Mark bought: ${it.name}`}
                />
                <div className="flex-1">
                  <div className="text-base">{it.name}</div>
                  <div className="text-xs text-gray-600">{it.qty} {it.unit||''}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

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
