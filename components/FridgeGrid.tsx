// components/FridgeGrid.tsx
'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, startOfWeek, getISOWeek } from 'date-fns'
import { db } from '@/lib/db'
import { ownerFor, eliUnloads } from '@/lib/oddEven'

/**
 * FridgeGrid — quick-glance board:
 *  - Dishes / Litter ownership (odd/even), mark done
 *  - Weekly Reset (Sundays) checklist (auto-clears Monday)
 *  - Zone of the Week with subtasks
 */
export default function FridgeGrid(){
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<{ startOfWeek?: number; zoneIndex?: number } | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneIdx, setZoneIdx] = useState<number>(0)
  const [weeklyReset, setWeeklyReset] = useState<ResetItem[]>(DEFAULT_WEEKLY_RESET)

  // completion state
  const [dishDone, setDishDone] = useState(false)
  const [litterDone, setLitterDone] = useState(false)
  const [resetDone, setResetDone] = useState<Record<number, boolean>>({}) // by index
  const [zoneChecks, setZoneChecks] = useState<Record<string, boolean>>({}) // key per subtask

  const isSunday = now.getDay() === 0
  const owner = useMemo(() => ownerFor(now), [now])
  const dateKey = format(now, 'yyyy-MM-dd')
  const dishKey = `dish-${dateKey}-${owner}`
  const litterKey = `litter-${dateKey}-${owner}`

  // figure the active week + zone
  const sow = useMemo(() => (prefs?.startOfWeek ?? 1) as 0|1|2|3|4|5|6, [prefs])
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: sow }), [now, sow])
  const weekStartStr = useMemo(() => format(weekStart, 'yyyy-MM-dd'), [weekStart])
  const isoWeek = useMemo(() => getISOWeek(weekStart), [weekStart])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const p = (await db.prefs.get('prefs')) || { startOfWeek: 1, zoneIndex: undefined }
      const zs = await db.zones.toArray().catch(()=> [])
      // compute zone index deterministically if not set
      const idx = (typeof p.zoneIndex === 'number' ? p.zoneIndex : isoWeek) % Math.max(1, zs.length || DEFAULT_ZONES.length)
      // load completion snapshots
      const [dRec, lRec] = await Promise.all([
        db.checkmarks.get(dishKey),
        db.checkmarks.get(litterKey),
      ])
      // weekly reset keys
      const resetStates: Record<number, boolean> = {}
      await Promise.all(DEFAULT_WEEKLY_RESET.map(async (item, i) => {
        const key = weeklyResetKey(weekStartStr, i)
        const ck = await db.checkmarks.get(key)
        resetStates[i] = Boolean(ck)
      }))
      // zone subtasks
      const zoneList = zs.length ? zs : DEFAULT_ZONES
      const z = zoneList[idx % zoneList.length]
      const zChecks: Record<string, boolean> = {}
      await Promise.all((z.subtasks || []).map(async (name, i) => {
        const key = zoneTaskKey(weekStartStr, z.id, i)
        const ck = await db.checkmarks.get(key)
        zChecks[key] = Boolean(ck)
      }))

      if (mounted){
        setPrefs(p); setZones(zoneList); setZoneIdx(idx)
        setDishDone(Boolean(dRec)); setLitterDone(Boolean(lRec))
        setResetDone(resetStates); setZoneChecks(zChecks)
      }
    })().finally(()=> mounted && setLoading(false))
    return () => { mounted = false }
  }, [dishKey, litterKey, isoWeek, weekStartStr])

  async function mark(key: string){
    await db.checkmarks.put({ id: key, date: dateKey, key, doneAt: Date.now() })
    if (key === dishKey) setDishDone(true)
    if (key === litterKey) setLitterDone(true)
  }

  async function toggleWeeklyReset(i: number){
    const key = weeklyResetKey(weekStartStr, i)
    const newVal = !resetDone[i]
    if (newVal) await db.checkmarks.put({ id: key, date: weekStartStr, key, doneAt: Date.now() })
    else await db.checkmarks.delete(key)
    setResetDone(prev => ({ ...prev, [i]: newVal }))
  }

  async function toggleZoneTask(z: Zone, i: number){
    const key = zoneTaskKey(weekStartStr, z.id, i)
    const newVal = !zoneChecks[key]
    if (newVal) await db.checkmarks.put({ id: key, date: weekStartStr, key, doneAt: Date.now() })
    else await db.checkmarks.delete(key)
    setZoneChecks(prev => ({ ...prev, [key]: newVal }))
  }

  if (loading) return <div className="card">Loading…</div>

  const zone = zones.length ? zones[zoneIdx % zones.length] : DEFAULT_ZONES[0]

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Row 1: Dishes / Litter */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Today’s Chores</h2>
          <div className="text-sm text-gray-600">{format(now, 'EEE, MMM d')}</div>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <button
            className="primary"
            aria-label={`Do Dishes — ${owner}`}
            disabled={dishDone}
            aria-disabled={dishDone}
            onClick={() => mark(dishKey)}
          >{dishDone ? 'Dishes ✓' : `Do Dishes — ${prettyOwner(owner)}`}</button>

          <button
            className="card w-full h-12"
            aria-label={`Scoop Litter — ${owner}`}
            disabled={litterDone}
            aria-disabled={litterDone}
            onClick={() => mark(litterKey)}
          >{litterDone ? 'Litter ✓' : `Scoop Litter — ${prettyOwner(owner)}`}</button>
          {eliUnloads(now) && (
            <div className="text-xs text-gray-600">Heads‑up: Eli unloads today (Mon–Fri).</div>
          )}
        </div>
      </section>

      {/* Row 2: Weekly Reset (Sundays) */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Weekly Reset {isSunday ? '' : <span className="text-xs text-gray-500">(Sunday)</span>}</h2>
          <div className="text-xs text-gray-600">Auto‑clears Monday</div>
        </div>
        <ul className="mt-2 space-y-2">
          {weeklyReset.map((item, i) => (
            <li key={i} className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-6 w-6 rounded"
                checked={Boolean(resetDone[i])}
                onChange={()=> toggleWeeklyReset(i)}
              />
              <span className="text-base">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Row 3: Zone of the Week */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Zone of the Week</h2>
          <Link href="/settings" className="text-sm underline">Edit</Link>
        </div>
        <div className="mt-1 font-semibold">{zone?.name || 'Zone'}</div>
        <ul className="mt-2 space-y-2">
          {(zone?.subtasks || []).map((name, i) => {
            const key = zoneTaskKey(weekStartStr, zone.id, i)
            return (
              <li key={i} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-6 w-6 rounded"
                  checked={Boolean(zoneChecks[key])}
                  onChange={()=> toggleZoneTask(zone, i)}
                />
                <span className="text-base">{name}</span>
              </li>
            )
          })}
          {(!zone?.subtasks || zone.subtasks.length===0) && (
            <li className="text-sm text-gray-600">No subtasks yet. Add some in Settings.</li>
          )}
        </ul>
      </section>

      {/* Links */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/print/fridge" className="card h-12 flex items-center justify-center">Print Fridge Grid</Link>
        <Link href="/today" className="card h-12 flex items-center justify-center">Back to Today</Link>
      </div>
    </div>
  )
}

function prettyOwner(o: string){ return o === 'you' ? 'You' : o === 'dom' ? 'Dom' : o }

// Weekly reset list (simple, editable via code or future Settings)
const DEFAULT_WEEKLY_RESET: ResetItem[] = [
  { label: 'Laundry reset' },
  { label: 'Clear kitchen surfaces' },
  { label: 'Vacuum high‑traffic areas' },
  { label: 'Plan week & appointments' },
]

// Fallback zones if DB empty
const DEFAULT_ZONES: Zone[] = [
  { id: 'zone-kitchen', name: 'Kitchen', subtasks: ['Wipe fronts', 'Microwave', 'Sink scrub', 'Fridge quick sort'] },
  { id: 'zone-bath', name: 'Bathrooms', subtasks: ['Toilets', 'Sinks', 'Counters & mirrors', 'Tubs/showers'] },
  { id: 'zone-floors', name: 'Floors', subtasks: ['Entry', 'Kitchen', 'Hallway', 'Living room'] },
  { id: 'zone-laundry', name: 'Laundry', subtasks: ['Baskets sorted', 'Run loads', 'Fold 15 min'] },
  { id: 'zone-entry', name: 'Entry/Car', subtasks: ['Shoe rack', 'Mail sort', 'Trash from car'] },
  { id: 'zone-bed', name: 'Bedrooms', subtasks: ['Nightstands', 'Clothes off floor', 'Change sheets'] },
]

// Key helpers
function weeklyResetKey(weekStartStr: string, index: number){ return `weekly-reset-${weekStartStr}-${index}` }
function zoneTaskKey(weekStartStr: string, zoneId: string, index: number){ return `zone-${weekStartStr}-${zoneId}-${index}` }

type Zone = { id: string; name: string; subtasks: string[] }
type ResetItem = { label: string }