'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { db } from '@/lib/db'
export default function TrashNightWizard(){
  const [loading, setLoading] = useState(true)
  const [flowStarted, setFlowStarted] = useState(false)
  const [steps, setSteps] = useState([false, false, false, false, false])
  const [completed, setCompleted] = useState<null | { doneAt: number; expiresAt: number }>(null)
  const now = new Date(); const isThursday = now.getDay() === 4
  const todayKey = useMemo(() => `trash-night-${format(now, 'yyyy-MM-dd')}`, [now])
  useEffect(() => { let mounted = true; (async () => { try { const rec = await db.checkmarks.get(todayKey); if (rec && rec.doneAt) { const expiresAt = (rec as any).expiresAt ?? nextNineAM(now).getTime(); if (Date.now() < expiresAt) mounted && setCompleted({ doneAt: rec.doneAt, expiresAt }) } } finally { mounted && setLoading(false) } })(); return () => { mounted = false } }, [todayKey])
  const stepLabels = ['Collect interior bins','Bag & tie','Take to curb','Replace liners','Set morning reminder']
  async function markDone(){ const expires = isThursday ? fridayNineAM(now) : nextNineAM(now); const payload = { id: todayKey, date: format(now, 'yyyy-MM-dd'), key: todayKey, doneAt: Date.now(), expiresAt: expires.getTime() }; try { await db.checkmarks.put(payload); setCompleted({ doneAt: payload.doneAt, expiresAt: payload.expiresAt }); confettiLite() } catch { alert('Could not save. If offline, it will retry.') } }
  async function reset(){ await db.checkmarks.delete(todayKey); setCompleted(null); setSteps([false,false,false,false,false]); setFlowStarted(false) }
  function toggleStep(i: number){ setSteps(prev => prev.map((v, idx) => (idx === i ? !v : v))) }
  function allChecked(){ return steps.every(Boolean) }
  if (loading) return <div className="card">Loading…</div>
  if (completed) return (<div className="card"><h2 className="text-xl font-extrabold">Trash Night is done</h2><p className="text-sm text-gray-600 mt-1">Completed at {new Date(completed.doneAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Clears {new Date(completed.expiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</p><div className="mt-3"><button aria-label="Reset Trash Night" className="card w-full h-12" onClick={reset}>Undo</button></div></div>)
  if (!flowStarted) return (<div className="card"><h2 className="text-xl font-extrabold">{isThursday ? 'Trash Night' : 'Trash Night (any day practice)'}</h2><p className="text-sm text-gray-600 mt-1">{isThursday ? 'Five quick steps. You’ve got this.' : 'You can run this anytime; completion clears at the next 9:00 AM.'}</p><div className="mt-3 space-y-2"><button aria-label="Start Trash Night" className="primary" onClick={() => setFlowStarted(true)}>Start Trash Night</button></div></div>)
  return (
    <div className="card">
      <h2 className="text-xl font-extrabold">{isThursday ? 'Trash Night' : 'Trash Night (any day practice)'}</h2>
      {!isThursday && (<p className="text-xs text-gray-600 mt-1">Not Thursday — practice mode. Completion will clear at 9:00 AM tomorrow.</p>)}
      <ol className="mt-3 space-y-2">{stepLabels.map((label, i) => { const id = `tn-${i}`; return (
        <li key={i} className="flex items-center gap-3">
          <input id={id} type="checkbox" className="h-6 w-6 rounded border-gray-300" checked={steps[i]} onChange={() => toggleStep(i)} aria-labelledby={`${id}-label`} />
          <label id={`${id}-label`} htmlFor={id} className="text-base select-none">{label}</label>
        </li>
      )})}</ol>
      <div className="mt-4 space-y-2"><button className="primary" disabled={!allChecked()} onClick={markDone}>Mark Trash Night Done</button><button className="card w-full h-12" onClick={() => setFlowStarted(false)}>Back</button></div>
      <div id="tn-confetti" aria-hidden="true" />
    </div>
  )
}
function fridayNineAM(base: Date){ const d = new Date(base); const day = d.getDay(); const diff = (5 - day + 7) % 7; d.setDate(d.getDate() + diff); d.setHours(9,0,0,0); return d }
function nextNineAM(base: Date){ const d = new Date(base); const beforeNine = d.getHours() < 9 || (d.getHours() === 9 && d.getMinutes() === 0 && d.getSeconds() === 0); if (beforeNine) d.setHours(9,0,0,0); else { d.setDate(d.getDate()+1); d.setHours(9,0,0,0) } return d }
function confettiLite(){ const host = (typeof document!=='undefined' && (document.getElementById('tn-confetti') || document.body)); if (!host) return; const frag = document.createDocumentFragment(); const count = 24; for (let i=0;i<count;i++){ const span = document.createElement('span'); span.textContent = i % 3 === 0 ? '🎉' : i % 3 === 1 ? '✨' : '🎈'; span.style.position = 'fixed'; span.style.left = Math.random() * 100 + 'vw'; span.style.top = '-10px'; span.style.pointerEvents = 'none'; span.style.transition = 'transform 1200ms ease-out, opacity 1200ms ease-out'; span.style.transform = `translateY(${60 + Math.random() * 60}vh) rotate(${(Math.random() - 0.5) * 120}deg)`; span.style.opacity = '0'; requestAnimationFrame(() => { span.style.opacity = '1'; span.style.transform = `translateY(${100 + Math.random() * 40}vh) rotate(${(Math.random() - 0.5) * 360}deg)` }); frag.appendChild(span); setTimeout(() => span.remove(), 1300) } host.appendChild(frag) }
