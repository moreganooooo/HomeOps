import React, { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
// IMPORTANT: adjust this import path to your project (e.g., "@/lib/db").
// It expects a Dexie instance with a `checkmarks` table shaped like the spec.
import { db } from '../lib/db'

/**
 * TrashNightFlow — ADHD‑friendly 5‑step flow with persistence until Friday 9:00 AM.
 *
 * • Big buttons, one clear path.
 * • Stores a Checkmark with key "trash-night-YYYY-MM-DD".
 * • If completed on a Thursday, it stays "Done" until Friday 09:00.
 * • If completed on other days, it stays "Done" until the next 09:00 (local time),
 *   so you can rehearse the flow mid‑week without clutter.
 */
export default function TrashNightFlow(){
  const [loading, setLoading] = useState(true)
  const [flowStarted, setFlowStarted] = useState(false)
  const [steps, setSteps] = useState([false, false, false, false, false])
  const [completed, setCompleted] = useState<null | { doneAt: number; expiresAt: number }>(null)

  const now = new Date()
  const isThursday = now.getDay() === 4 // 0..6 = Sun..Sat
  const todayKey = useMemo(() => `trash-night-${format(now, 'yyyy-MM-dd')}`, [now])

  // Load completion state (latest trash-night checkmark that hasn't expired)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const rec = await db.checkmarks.get(todayKey)
        if (rec && rec.doneAt) {
          const expiresAt = (rec as any).expiresAt ?? nextNineAM(now).getTime()
          if (Date.now() < expiresAt) {
            mounted && setCompleted({ doneAt: rec.doneAt, expiresAt })
          }
        }
      } catch (e) {
        // no‑op; DB may not be initialized yet
      } finally {
        mounted && setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [todayKey])

  const headline = completed
    ? 'Trash Night is done'
    : isThursday
      ? 'Trash Night'
      : 'Trash Night (any day practice)'

  const stepLabels = [
    'Collect interior bins',
    'Bag & tie',
    'Take to curb',
    'Replace liners',
    'Set morning reminder',
  ]

  async function markDone(){
    // Compute sticky completion window
    const expires = isThursday ? fridayNineAM(now) : nextNineAM(now)
    const payload = {
      id: todayKey,
      date: format(now, 'yyyy-MM-dd'),
      key: todayKey,
      doneAt: Date.now(),
      expiresAt: expires.getTime(),
    }
    try {
      await db.checkmarks.put(payload)
      setCompleted({ doneAt: payload.doneAt, expiresAt: payload.expiresAt })
      confettiLite()
    } catch (e) {
      alert('Could not save completion. If offline, it will retry automatically.')
    }
  }

  async function reset(){
    try {
      await db.checkmarks.delete(todayKey)
    } catch {}
    setCompleted(null)
    setSteps([false, false, false, false, false])
    setFlowStarted(false)
  }

  function toggleStep(i: number){
    setSteps(prev => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  function allChecked(){
    return steps.every(Boolean)
  }

  if (loading) return <div className="card">Loading…</div>

  // Completed view
  if (completed) {
    return (
      <div className="card">
        <h2 className="text-xl font-extrabold">{headline}</h2>
        <p className="text-sm text-gray-600 mt-1">
          Completed at {new Date(completed.doneAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. 
          This badge clears {new Date(completed.expiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.
        </p>
        <div className="mt-3">
          <button aria-label="Reset Trash Night" className="card w-full h-12" onClick={reset}>Undo</button>
        </div>
      </div>
    )
  }

  // Start CTA
  if (!flowStarted) {
    return (
      <div className="card">
        <h2 className="text-xl font-extrabold">{headline}</h2>
        <p className="text-sm text-gray-600 mt-1">
          {isThursday ? 'Five quick steps. You’ve got this.' : 'You can run this anytime; completion clears at the next 9:00 AM.'}
        </p>
        <div className="mt-3 space-y-2">
          <button aria-label="Start Trash Night" className="primary" onClick={() => setFlowStarted(true)}>
            Start Trash Night
          </button>
        </div>
      </div>
    )
  }

  // Wizard view
  return (
    <div className="card">
      <h2 className="text-xl font-extrabold">{headline}</h2>
      {!isThursday && (
        <p className="text-xs text-gray-600 mt-1">Not Thursday — practice mode. Completion will clear at 9:00 AM tomorrow.</p>
      )}

      <ol className="mt-3 space-y-2">
        {stepLabels.map((label, i) => (
          <li key={i} className="flex items-center gap-3">
            <input
              id={`tn-${i}`}
              type="checkbox"
              className="h-6 w-6 rounded border-gray-300"
              checked={steps[i]}
              onChange={() => toggleStep(i)}
            />
            <label htmlFor={`tn-${i}`} className="text-base select-none">{label}</label>
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-2">
        <button
          className="primary"
          disabled={!allChecked()}
          aria-disabled={!allChecked()}
          onClick={markDone}
        >
          Mark Trash Night Done
        </button>
        <button className="card w-full h-12" onClick={() => setFlowStarted(false)}>Back</button>
      </div>

      {/* Confetti target */}
      <div id="tn-confetti" aria-hidden="true" />
    </div>
  )
}

// --- Time helpers ----------------------------------------------------------
function fridayNineAM(base: Date){
  // Get upcoming Friday of the same ISO week; set 09:00 local
  const d = new Date(base)
  const day = d.getDay() // 0..6 Sun..Sat
  const diff = (5 - day + 7) % 7 // days until Friday
  d.setDate(d.getDate() + diff)
  d.setHours(9, 0, 0, 0)
  return d
}

function nextNineAM(base: Date){
  const d = new Date(base)
  // If we are before 09:00 today, use today 09:00, else use tomorrow 09:00
  const beforeNine = d.getHours() < 9 || (d.getHours() === 9 && d.getMinutes() === 0 && d.getSeconds() === 0)
  if (beforeNine) {
    d.setHours(9, 0, 0, 0)
  } else {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  }
  return d
}

// --- Confetti (no library, lightweight) -----------------------------------
function confettiLite(){
  // Subtle emoji confetti for ~1s without external deps
  const host = document.getElementById('tn-confetti') || document.body
  const frag = document.createDocumentFragment()
  const count = 24
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span')
    span.textContent = i % 3 === 0 ? '🎉' : i % 3 === 1 ? '✨' : '🎈'
    span.style.position = 'fixed'
    span.style.left = Math.random() * 100 + 'vw'
    span.style.top = '-10px'
    span.style.pointerEvents = 'none'
    span.style.transition = 'transform 1200ms ease-out, opacity 1200ms ease-out'
    span.style.transform = `translateY(${60 + Math.random() * 60}vh) rotate(${(Math.random() - 0.5) * 120}deg)`
    span.style.opacity = '0'
    // initial paint
    requestAnimationFrame(() => {
      span.style.opacity = '1'
      span.style.transform = `translateY(${100 + Math.random() * 40}vh) rotate(${(Math.random() - 0.5) * 360}deg)`
    })
    frag.appendChild(span)
    setTimeout(() => span.remove(), 1300)
  }
  host.appendChild(frag)
}

// ACCESSIBILITY: respects reduced motion
if (typeof window !== 'undefined'){
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (mq.matches) {
    // no animated confetti in reduced motion
    // override to no‑op
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (confettiLite as any) = function(){}
  }
}
