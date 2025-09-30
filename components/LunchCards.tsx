// components/LunchCards.tsx
'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { format, startOfWeek } from 'date-fns'
import { db } from '@/lib/db'

/**
 * LunchCards — Mon–Fri rotating lunch plan for Eli.
 *  - Reads LunchPlan for the active weekType
 *  - If empty, seeds with sensible defaults (Week 1 cold, Week 2 thermos)
 *  - Lets you mark each day as "Packed" (clears at midnight)
 */
export default function LunchCards(){
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<{ startOfWeek?: number } | null>(null)
  const [weekType, setWeekType] = useState<1|2>(1)
  const [cards, setCards] = useState<Array<{ day: string; item: string }>>([])
  const [packed, setPacked] = useState<Record<string, boolean>>({})

  const sow = useMemo(() => (prefs?.startOfWeek ?? 1) as 0|1|2|3|4|5|6, [prefs])
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: sow }), [now, sow])
  const weekStartStr = useMemo(() => format(weekStart, 'yyyy-MM-dd'), [weekStart])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const p = (await db.prefs.get('prefs')) || { startOfWeek: 1, activeWeekType: undefined }
      setPrefs(p)

      // get mealWeek for weekStart
      const mw = await (db as any).mealWeeks?.get?.(weekStartStr)
      const type = (mw?.weekType as 1|2) || inferWeekType() // fallback based on parity
      setWeekType(type)

      // pull lunch plan rows
      let arr = await (db as any).lunches?.where?.('weekType').equals(type).toArray()
      if (!arr || arr.length === 0) {
        // seed defaults from code (can be replaced by your plan)
        const defaults = (type === 1 ? DEFAULT_WEEK1 : DEFAULT_WEEK2).map((item, i) => ({
          id: `lunch-${type}-${i}`,
          weekType: type,
          day: DAYS[i],
          item,
        }))
        await Promise.all(defaults.map(d => (db as any).lunches?.put?.(d)))
        arr = defaults as any
      }

      // load packed marks from Checkmarks (per date)
      const pks: Record<string, boolean> = {}
      await Promise.all(DAYS.slice(0,5).map(async (d, i) => {
        const date = format(addDaysSafe(weekStart, i+1), 'yyyy-MM-dd') // Mon..Fri
        const key = `lunch-${date}-eli`
        const ck = await db.checkmarks.get(key)
        pks[key] = Boolean(ck)
      }))

      if (mounted){
        setCards(arr.map((x: any) => ({ day: x.day, item: x.item })))
        setPacked(pks)
      }
    })().finally(()=> mounted && setLoading(false))
    return () => { mounted = false }
  }, [weekStartStr])

  async function togglePacked(idx: number){
    const date = format(addDaysSafe(weekStart, idx+1), 'yyyy-MM-dd') // Mon..Fri
    const key = `lunch-${date}-eli`
    const newVal = !packed[key]
    if (newVal) await db.checkmarks.put({ id: key, date, key, doneAt: Date.now() })
    else await db.checkmarks.delete(key)
    setPacked(prev => ({ ...prev, [key]: newVal }))
  }

  if (loading) return <div className="card">Loading…</div>

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Eli Lunch (Week {weekType})</h2>
        <span className="text-sm text-gray-600">{format(weekStart, 'MMM d')} – {format(addDaysSafe(weekStart, 4), 'MMM d')}</span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-2">
        {DAYS.slice(0,5).map((day, i) => {
          const item = cards[i]?.item || '—'
          const date = format(addDaysSafe(weekStart, i+1), 'EEE, MMM d')
          const key = `lunch-${format(addDaysSafe(weekStart, i+1), 'yyyy-MM-dd')}-eli`
          const isPacked = Boolean(packed[key])
          return (
            <li key={day} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{day}</div>
                <div className="text-sm text-gray-700">{item}</div>
                <div className="text-xs text-gray-500">{date}</div>
              </div>
              <button
                className={`h-10 px-4 rounded-2xl font-bold ${isPacked?'bg-black text-white':'card'}`}
                onClick={() => togglePacked(i)}
                aria-pressed={isPacked}
              >{isPacked ? 'Packed ✓' : 'Mark Packed'}</button>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 text-xs text-gray-500">Edit items in Settings → Lunch Plan (or seed via Sunday Prep).</div>
    </section>
  )
}

// helpers
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const
function addDaysSafe(date: Date, n: number){ const d = new Date(date); d.setDate(d.getDate()+n); return d }
function inferWeekType(){ return (Math.floor(Date.now()/(7*24*60*60*1000)) % 2 === 0) ? 1 : 2 }

const DEFAULT_WEEK1 = [
  'Turkey sandwich + carrots + apple',
  'Ham & cheese + yogurt + grapes',
  'Chicken salad wrap + chips',
  'PB&J + string cheese + cucumber',
  'Snacky lunch (crackers, hummus, fruit)'
]
const DEFAULT_WEEK2 = [
  'Thermos mac & cheese + fruit',
  'Chicken noodle soup + crackers',
  'Leftover pasta + veg cup',
  'Chili + cornbread muffin',
  'Rice & beans + cheese'
]
