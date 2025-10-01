'use client'

import React, { useEffect, useState } from 'react'
import { db, type Member, type Zone } from '@/lib/db'
import { subscribePush, unsubscribePush, getPushStatus, type NormalizedPermission } from '@/lib/push'

export default function SettingsPage(){
  const [loading, setLoading] = useState(true)

  // Household
  const [tz, setTz] = useState('America/New_York')
  const [startOfWeek, setStartOfWeek] = useState<0|1>(1)
  const [trashReminder, setTrashReminder] = useState(false)
  const [prepReminder, setPrepReminder] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Push status
  const [pushSupported, setPushSupported] = useState(false)
  const [pushReady, setPushReady] = useState<NormalizedPermission | 'unknown'>('unknown')

  // Members / Zones
  const [members, setMembers] = useState<Member[]>([])
  const [zones, setZones] = useState<Zone[]>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const prefs = await db.prefs.get('prefs')
      const ms = await db.members.toArray()
      const zs = await db.zones.toArray()
      if (mounted){
        setTz(prefs?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York')
        setStartOfWeek(((prefs?.startOfWeek ?? 1) === 0 ? 0 : 1))
        setTrashReminder(Boolean((prefs as any)?.trashReminder))
        setPrepReminder(Boolean((prefs as any)?.prepReminder))
        setMembers(ms)
        setZones(zs)
      }
      const s = await getPushStatus()
      if (mounted){ setPushSupported(s.supported); setPushReady(s.permission) }
    })().finally(()=> setLoading(false))
    return () => { mounted = false }
  }, [])

  async function savePrefs(){
    setSavingPrefs(true)
    try {
      await db.prefs.put({ id:'prefs', timezone: tz, startOfWeek, activeWeekType: 1, zoneIndex: 0, trashReminder, prepReminder } as any)
      if (pushSupported){
        if (trashReminder || prepReminder){ await subscribePush().catch(()=>{}) }
        else { await unsubscribePush().catch(()=>{}) }
      }
    } finally { setSavingPrefs(false) }
  }

  // Members CRUD
  function addMember(){ const id = `m-${crypto.randomUUID()}`; setMembers(prev => [...prev, { id, name: 'New Member', color: '#6366f1' } as Member]) }
  function updateMember(id: string, patch: Partial<Member>){ setMembers(prev => prev.map(m => m.id===id? { ...m, ...patch } : m)) }
  function removeMember(id: string){ setMembers(prev => prev.filter(m => m.id !== id)) }
  async function saveMembers(){ await db.members.bulkPut(members) }

  // Zones CRUD
  function addZone(){ const id = `zone-${crypto.randomUUID()}`; setZones(prev => [...prev, { id, name: 'New Zone', subtasks: [] }]) }
  function updateZone(id: string, patch: Partial<Zone>){ setZones(prev => prev.map(z => z.id===id? { ...z, ...patch } : z)) }
  function removeZone(id: string){ setZones(prev => prev.filter(z => z.id !== id)) }
  function addSubtask(z: Zone){ updateZone(z.id, { subtasks: [...z.subtasks, ''] }) }
  function updateSubtask(z: Zone, idx: number, val: string){ const arr = [...z.subtasks]; arr[idx] = val; updateZone(z.id, { subtasks: arr }) }
  function removeSubtask(z: Zone, idx: number){ const arr = z.subtasks.filter((_,i)=> i!==idx); updateZone(z.id, { subtasks: arr }) }
  async function saveZones(){ await db.zones.bulkPut(zones) }

  if (loading) return <div className="card">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Settings</h1>

      {/* Household */}
      <section className="card">
        <h2 className="text-xl font-bold">Household</h2>
        <div className="mt-2 grid grid-cols-1 gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-gray-700">Time zone</span>
            <input className="h-12 rounded-2xl border px-3" value={tz} onChange={e=> setTz(e.target.value)} placeholder="e.g., America/New_York" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-gray-700">Start of week</span>
            <select className="h-12 rounded-2xl border px-3" value={startOfWeek} onChange={e=> setStartOfWeek(Number(e.target.value) as 0|1)}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>

          <div className="grid grid-cols-1 gap-2">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={trashReminder} onChange={e=> setTrashReminder(e.currentTarget.checked)} />
              Trash Night reminders (Thu 7:55 PM)
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={prepReminder} onChange={e=> setPrepReminder(e.currentTarget.checked)} />
              Sunday Prep reminders (Sun 11:00 AM)
            </label>
            {!pushSupported && <div className="text-xs text-red-600">Push requires HTTPS + a service worker. We've added a basic SW; set your Worker URL + VAPID key for production.</div>}
            {pushSupported && pushReady==='denied' && <div className="text-xs text-red-600">Notifications are blocked in your browser.</div>}
          </div>

          <div>
            <button onClick={savePrefs} className="primary" disabled={savingPrefs}>{savingPrefs? 'Saving…':'Save Household Settings'}</button>
          </div>
        </div>
      </section>

      {/* Google Calendar */}
      <CalendarSection />

      {/* Members */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Members</h2>
          <button className="card h-10 px-3" onClick={addMember}>Add</button>
        </div>
        <ul className="mt-2 space-y-3">
          {members.map((m, idx) => (
            <li key={m.id} className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-3 gap-2">
                <input aria-label={`Member ${idx+1} name`} placeholder="Name" className="h-12 rounded-2xl border px-3 col-span-2" value={m.name} onChange={e=> updateMember(m.id, { name: e.target.value })} />
                <input aria-label={`Member ${idx+1} color`} title="Color" className="h-12 rounded-2xl border px-3" type="color" value={m.color} onChange={e=> updateMember(m.id, { color: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button className="card h-10 px-3" onClick={()=> removeMember(m.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3"><button className="primary" onClick={saveMembers}>Save Members</button></div>
      </section>

      {/* Zones */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Zones</h2>
          <button className="card h-10 px-3" onClick={addZone}>Add Zone</button>
        </div>
        <ul className="mt-2 space-y-4">
          {zones.map((z, zi) => (
            <li key={z.id} className="grid gap-2">
              <input aria-label={`Zone ${zi+1} name`} placeholder="Zone name" className="h-12 rounded-2xl border px-3" value={z.name} onChange={e=> updateZone(z.id, { name: e.target.value })} />
              <div className="grid gap-2">
                {(z.subtasks||[]).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input aria-label={`Subtask ${i+1} for zone ${zi+1}`} placeholder="Subtask" className="flex-1 h-12 rounded-2xl border px-3" value={s} onChange={e=> updateSubtask(z, i, e.target.value)} />
                    <button className="card h-10 px-3" onClick={()=> removeSubtask(z, i)} title={`Remove subtask ${i+1}`}>Remove</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button className="card h-10 px-3" onClick={()=> addSubtask(z)}>Add Subtask</button>
                <button className="card h-10 px-3" onClick={()=> removeZone(z.id)}>Delete Zone</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3"><button className="primary" onClick={saveZones}>Save Zones</button></div>
      </section>
    </div>
  )
}

function CalendarSection(){
  const [connected, setConnected] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const worker = process.env.NEXT_PUBLIC_WORKER_URL
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hint = !worker ? 'Set NEXT_PUBLIC_WORKER_URL in .env.local' : ''

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!worker) { setConnected(false); return } 
      try { const j: { connected: boolean } = await fetch(`${worker}/status`).then(r=>r.json()); if (mounted) setConnected(Boolean(j.connected)) }
      catch { if (mounted) setConnected(false) }
    })()
    return () => { mounted = false }
  }, [worker])

  return (
    <section className="card">
      <h2 className="text-xl font-bold">Google Calendar</h2>
      <p className="text-sm text-gray-600">Write Sunday Prep + Trash Night directly to your calendar.</p>
      {!worker && <div className="text-xs text-red-600 mt-1">{hint}</div>}

      <div className="mt-2 grid grid-cols-1 gap-2">
        {connected ? (
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (!worker) return
              setBusy(true)
              try {
                await fetch(`${worker}/events/upsert`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ timezone: tz, origin }) })
                alert('Calendar events created/updated!')
              } catch (e) {
                alert('Could not update calendar. Check Worker logs.')
              } finally { setBusy(false) }
            }}
          >{busy? 'Updating…' : 'Create/Update Events'}</button>
        ) : (
          <button
            className="primary"
            onClick={() => {
              if (!worker) return
              const url = `${worker}/auth?forward=${encodeURIComponent(`${origin}/settings`)}`
              window.location.href = url
            }}
          >Connect Google Calendar</button>
        )}
      </div>
      <div className="text-xs text-gray-600 mt-1">Defaults: Sunday 11:00 AM, Thursday 7:55 PM (your timezone).</div>
    </section>
  )
}
