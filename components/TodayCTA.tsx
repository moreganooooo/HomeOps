'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, startOfWeek } from 'date-fns'
import { db } from '@/lib/db'
import { ownerFor, eliUnloads } from '@/lib/oddEven'
import TrashNightWizard from '@/components/TrashNightWizard'

export default function TodayCTA(){
  const router = useRouter()
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [showTrashWizard, setShowTrashWizard] = useState(false)
  const [trashDoneUntil, setTrashDoneUntil] = useState<number | null>(null)
  const [dishDone, setDishDone] = useState(false)
  const [litterDone, setLitterDone] = useState(false)
  const [sundayPrepDone, setSundayPrepDone] = useState<boolean | null>(null)
  const isThursday = now.getDay() === 4
  const isSunday = now.getDay() === 0
  const dateKey = format(now, 'yyyy-MM-dd')
  const trashKey = `trash-night-${dateKey}`
  const dishKey = (owner: string) => `dish-${dateKey}-${owner}`
  const litterKey = (owner: string) => `litter-${dateKey}-${owner}`
  const owner = useMemo(() => ownerFor(now), [now])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const trash = await db.checkmarks.get(trashKey)
        if (trash && (trash as any).expiresAt && Date.now() < (trash as any).expiresAt) { mounted && setTrashDoneUntil((trash as any).expiresAt) }
        const [d, l] = await Promise.all([ db.checkmarks.get(dishKey(owner)), db.checkmarks.get(litterKey(owner)) ])
        mounted && setDishDone(Boolean(d)); mounted && setLitterDone(Boolean(l))
        try {
          const prefs = await db.prefs.get('prefs')
          const weekStart = startOfWeek(now, { weekStartsOn: (prefs?.startOfWeek ?? 1) as 0|1|2|3|4|5|6 })
          const weekKey = format(weekStart, 'yyyy-MM-dd')
          const mealWeek = await (db as any).mealWeeks?.get?.(weekKey)
          if (mounted) setSundayPrepDone(Boolean(mealWeek?.sundayPrepDone))
        } catch { if (mounted) setSundayPrepDone(null) }
      } finally { mounted && setLoading(false) }
    })()
    return () => { mounted = false }
  }, [trashKey, owner])

  const primary: 'trash' | 'sunday' | 'dishes' = (() => { if (isThursday && !trashDoneUntil) return 'trash'; if (isSunday && sundayPrepDone === false) return 'sunday'; return 'dishes' })()
  async function mark(key: string){ await db.checkmarks.put({ id: key, date: dateKey, key, doneAt: Date.now() }); if (key.startsWith('dish')) setDishDone(true); if (key.startsWith('litter')) setLitterDone(true); confettiLite() }
  if (loading) return <div className="card">Loading…</div>

  if (showTrashWizard) return (<div className="space-y-3"><TrashNightWizard/><button className="card w-full h-12" onClick={() => setShowTrashWizard(false)}>Back to Today</button></div>)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Today</h1>
      {primary === 'trash' && (<div className="space-y-2"><button className="primary" aria-label="Start Trash Night" onClick={() => setShowTrashWizard(true)}>Start Trash Night</button><p className="text-sm text-gray-600">Five quick steps. Badge stays until Friday 9:00 AM.</p></div>)}
      {primary === 'sunday' && (<div className="space-y-2"><button className="primary" aria-label="Start Sunday Prep" onClick={() => router.push('/meals')}>Start Sunday Prep</button><p className="text-sm text-gray-600">Prefill Week {weekTypeText()} and generate groceries.</p></div>)}
      {primary === 'dishes' && (
        <div className="space-y-2">
          <button className="primary" aria-label={`Do Dishes — ${owner}`} disabled={dishDone} onClick={() => mark(dishKey(owner))}>{dishDone ? 'Dishes ✓' : `Do Dishes — ${prettyOwner(owner)}`}</button>
          <div className="grid grid-cols-1 gap-2">
            <button className="card w-full h-12" aria-label={`Scoop Litter — ${owner}`} disabled={litterDone} onClick={() => mark(litterKey(owner))}>{litterDone ? 'Litter ✓' : `Scoop Litter — ${prettyOwner(owner)}`}</button>
            {eliUnloads(now) && (<div className="text-xs text-gray-600">Heads‑up: Eli unloads today (Mon–Fri).</div>)}
          </div>
        </div>
      )}
      {trashDoneUntil && (<div className="card"><div className="font-semibold">Trash Night — Done</div><div className="text-xs text-gray-600">Clears {new Date(trashDoneUntil).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</div><button className="card w-full h-10 mt-2" onClick={() => setShowTrashWizard(true)}>View Steps</button></div>)}
      <div className="grid grid-cols-2 gap-2"><Link href="/chores" className="card h-12 flex items-center justify-center">Chores</Link><Link href="/grocery" className="card h-12 flex items-center justify-center">Groceries</Link></div>
    </div>
  )
}
function prettyOwner(o: string){ if (o === 'you') return 'You'; if (o === 'dom') return 'Dom'; return o }
function weekTypeText(){ const w = Math.floor(Date.now() / (7*24*60*60*1000)); return w % 2 ? '2' : '1' }
function confettiLite(){ if (typeof window === 'undefined') return; const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce) return; const frag = document.createDocumentFragment(); for (let i=0;i<16;i++){ const n = document.createElement('span'); n.textContent = i%2 ? '✨' : '🎉'; Object.assign(n.style, { position:'fixed', left: Math.random()*100+'vw', top:'-10px', transition:'transform 900ms ease-out, opacity 900ms ease-out', opacity:'0' }); requestAnimationFrame(()=>{ n.style.opacity = '1'; n.style.transform = `translateY(${90+Math.random()*20}vh) rotate(${(Math.random()-.5)*360}deg)` }); setTimeout(()=> n.remove(), 1000); frag.appendChild(n) } document.body.appendChild(frag) }