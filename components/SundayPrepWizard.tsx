import React, { useEffect, useMemo, useState } from 'react'
import { addDays, format, startOfWeek as dfStartOfWeek } from 'date-fns'
// Adjust paths to your repo
import { db } from '@/lib/db'
import { consolidate } from '@/lib/groceries'

/**
 * SundayPrepWizard — Prefills Week 1/2 anchors, generates grocery list,
 * creates dinner cards, and marks sundayPrepDone for the active week.
 *
 * Week 1 anchors: shredded chicken + taco meat
 * Week 2 anchors: meatballs + alfredo + veggie purée
 */
export default function SundayPrepWizard(){
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<{ startOfWeek?: number; activeWeekType?: 1|2 } | null>(null)
  const [weekType, setWeekType] = useState<1|2>(1)
  const [weekStartStr, setWeekStartStr] = useState('')
  const [prepConfirmed, setPrepConfirmed] = useState(false)
  const [groceries, setGroceries] = useState<Array<Item>>([])
  const [dinners, setDinners] = useState<Array<{ day: string; title: string }>>([])
  const [doneState, setDoneState] = useState<{ done: boolean; doneAt?: number } | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      // load prefs and compute weekStart
      const p = (await db.prefs.get('prefs')) || { startOfWeek: 1, activeWeekType: undefined }
      const sow = (p.startOfWeek ?? 1) as 0|1|2|3|4|5|6
      const ws = dfStartOfWeek(now, { weekStartsOn: sow })
      const wsStr = format(ws, 'yyyy-MM-dd')

      // infer week type
      const inferred = inferWeekType(p.activeWeekType, ws)

      // existing mealWeek?
      const mw = await (db as any).mealWeeks?.get?.(wsStr)
      const alreadyDone = Boolean(mw?.sundayPrepDone)

      if (!mw) {
        // initialize mealWeek row
        await (db as any).mealWeeks?.put?.({ weekStart: wsStr, weekType: inferred, sundayPrepDone: false })
      }

      if (mounted){
        setPrefs(p)
        setWeekType(inferred)
        setWeekStartStr(wsStr)
        setDoneState({ done: alreadyDone, doneAt: (mw as any)?.doneAt })
      }
    })().finally(()=> mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  // Anchors + default dinners for selected week
  const anchors = useMemo(() => anchorsFor(weekType), [weekType])
  const defaultDinners = useMemo(() => dinnersFor(weekType), [weekType])

  async function generate(){
    // generate dinner cards for Mon..Sun if not present
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    const cards = days.map((d, i) => ({ day: d, title: defaultDinners[i] }))

    // groceries from anchors + dinners
    const items = consolidate([...ingredientsForAnchors(weekType), ...ingredientsForDinners(defaultDinners)])

    // persist
    await Promise.all([
      // wipe + write dinner cards for this week
      (async () => {
        try {
          const existing = await (db as any).dinnerCards?.where?.('weekStart').equals(weekStartStr).toArray()
          if (existing?.length) {
            await Promise.all(existing.map((c: any) => (db as any).dinnerCards.delete(c.id)))
          }
        } catch {}
        await Promise.all(cards.map((c, idx) => (db as any).dinnerCards?.put?.({
          id: `dinner-${weekStartStr}-${idx}`,
          weekStart: weekStartStr,
          day: c.day,
          title: c.title,
        })))
      })(),
      // wipe + write groceries for this week
      (async () => {
        try {
          const existing = await (db as any).groceries?.where?.('weekStart').equals(weekStartStr).toArray()
          if (existing?.length) {
            await Promise.all(existing.map((g: any) => (db as any).groceries.delete(g.id)))
          }
        } catch {}
        await Promise.all(items.map((it, i) => (db as any).groceries?.put?.({
          id: `groc-${weekStartStr}-${i}`,
          weekStart: weekStartStr,
          name: it.name,
          qty: it.qty,
          unit: it.unit,
          section: it.section,
          checked: false,
        })))
      })(),
    ])

    setGroceries(items)
    setDinners(cards)
  }

  async function markDone(){
    await (db as any).mealWeeks?.put?.({ weekStart: weekStartStr, weekType, sundayPrepDone: true, doneAt: Date.now() })
    setDoneState({ done: true, doneAt: Date.now() })
    confettiLite()
  }

  async function undo(){
    await (db as any).mealWeeks?.put?.({ weekStart: weekStartStr, weekType, sundayPrepDone: false })
    setDoneState({ done: false })
  }

  if (loading) return <div className="card">Loading…</div>

  if (doneState?.done) {
    return (
      <div className="card">
        <h2 className="text-xl font-extrabold">Sunday Prep — Done</h2>
        <p className="text-sm text-gray-600 mt-1">Completed at {doneState.doneAt ? new Date(doneState.doneAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}.</p>
        <div className="mt-3 space-y-2">
          <button className="card w-full h-12" onClick={undo}>Undo</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-extrabold">Sunday Prep</h2>

      {/* Step 1 — Week Type */}
      <div className="mt-2">
        <div className="text-sm text-gray-700">Week type</div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            className={`h-12 rounded-2xl font-bold ${weekType===1?'bg-black text-white':'card'}`}
            onClick={()=> setWeekType(1)}
            aria-pressed={weekType===1}
          >Week 1</button>
          <button
            className={`h-12 rounded-2xl font-bold ${weekType===2?'bg-black text-white':'card'}`}
            onClick={()=> setWeekType(2)}
            aria-pressed={weekType===2}
          >Week 2</button>
        </div>
      </div>

      {/* Step 2 — Anchors */}
      <div className="mt-4">
        <div className="text-sm text-gray-700">Anchored prep</div>
        <ul className="mt-1 space-y-1">
          {anchors.map(a => <li key={a} className="text-base">☐ {a}</li>)}
        </ul>
        <div className="mt-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prepConfirmed} onChange={e=> setPrepConfirmed(e.currentTarget.checked)} className="h-5 w-5"/>
            I cooked/prepped these.
          </label>
        </div>
      </div>

      {/* Step 3 — Generate groceries */}
      <div className="mt-4 space-y-2">
        <button className="primary" disabled={!prepConfirmed} aria-disabled={!prepConfirmed} onClick={generate}>
          Generate Grocery List + Prefill Dinners
        </button>
        {groceries.length>0 && (
          <div className="mt-2">
            <div className="font-semibold">Groceries preview</div>
            <ul className="mt-1 text-sm grid grid-cols-1 gap-1">
              {groceries.slice(0,12).map((g,i)=> (
                <li key={i}>{g.name} — {g.qty} {g.unit||''} <span className="text-gray-500">({g.section||'Other'})</span></li>
              ))}
              {groceries.length>12 && <li>…and {groceries.length-12} more</li>}
            </ul>
          </div>
        )}
        {dinners.length>0 && (
          <div className="mt-3">
            <div className="font-semibold">Dinner plan</div>
            <ul className="mt-1 text-sm grid grid-cols-2 gap-1">
              {dinners.map((d,i)=> <li key={i}>{d.day}: {d.title}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Step 4 — Mark done */}
      <div className="mt-4">
        <button className="primary" disabled={groceries.length===0} aria-disabled={groceries.length===0} onClick={markDone}>
          Mark Sunday Prep Done
        </button>
      </div>

    </div>
  )
}

// ---------- Helpers & static meal plans ------------------------------------

function inferWeekType(pref: 1|2 | undefined, weekStart: Date): 1|2 {
  if (pref === 1 || pref === 2) return pref
  // Fallback: parity of weeks since epoch aligned to local startOfWeek
  const epoch = new Date(1970,0,5) // Monday Jan 5, 1970
  const weeks = Math.floor((weekStart.getTime() - startOfWeekAligned(epoch, weekStart).getTime()) / (7*24*60*60*1000))
  return (weeks % 2 === 0) ? 1 : 2
}

function startOfWeekAligned(date: Date, alignTo: Date){
  const d = new Date(date)
  const dow = alignTo.getDay() // 0..6
  const cur = d.getDay()
  const diff = (cur - dow + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0,0,0,0)
  return d
}

type Item = { name: string; qty: number; unit?: string; section?: string }

function anchorsFor(week: 1|2){
  return week === 1
    ? ['Shredded chicken (slow cooker)', 'Taco meat (stovetop)']
    : ['Meatballs (baked)', 'Alfredo sauce', 'Veggie purée']
}

function dinnersFor(week: 1|2){
  return week === 1
    ? ['Chicken tacos','BBQ chicken bowls','Chicken quesadillas','Taco night','Chicken Caesar wraps','Leftovers','Free night']
    : ['Spaghetti & meatballs','Alfredo pasta','Meatball subs','Chicken & broccoli alfredo','Pizza night','Leftovers','Free night']
}

function ingredientsForAnchors(week: 1|2): Item[] {
  if (week === 1) {
    return [
      { name: 'Chicken breast', qty: 5, unit: 'lb', section: 'Meat' },
      { name: 'Taco seasoning', qty: 4, unit: 'packets', section: 'Pantry' },
      { name: 'Chicken stock', qty: 2, unit: 'qt', section: 'Pantry' },
      { name: 'Ground beef', qty: 2, unit: 'lb', section: 'Meat' },
      { name: 'Onion', qty: 2, unit: 'pc', section: 'Produce' },
    ]
  }
  return [
    { name: 'Ground beef', qty: 2, unit: 'lb', section: 'Meat' },
    { name: 'Breadcrumbs', qty: 1, unit: 'cup', section: 'Pantry' },
    { name: 'Eggs', qty: 2, unit: 'pc', section: 'Dairy' },
    { name: 'Marinara', qty: 2, unit: 'jar', section: 'Pantry' },
    { name: 'Heavy cream', qty: 2, unit: 'pt', section: 'Dairy' },
    { name: 'Parmesan', qty: 1, unit: 'lb', section: 'Dairy' },
    { name: 'Butter', qty: 1, unit: 'lb', section: 'Dairy' },
    { name: 'Garlic', qty: 1, unit: 'head', section: 'Produce' },
    { name: 'Frozen mixed veg', qty: 2, unit: 'lb', section: 'Frozen' },
  ]
}

function ingredientsForDinners(titles: string[]): Item[] {
  // Very light mapping to add produce/staples
  const map: Record<string, Item[]> = {
    'Chicken tacos': [
      { name: 'Tortillas', qty: 20, unit: 'ct', section: 'Bakery' },
      { name: 'Lettuce', qty: 1, unit: 'head', section: 'Produce' },
      { name: 'Tomatoes', qty: 4, unit: 'pc', section: 'Produce' },
      { name: 'Sour cream', qty: 1, unit: 'pt', section: 'Dairy' },
    ],
    'BBQ chicken bowls': [
      { name: 'Rice', qty: 2, unit: 'lb', section: 'Pantry' },
      { name: 'Frozen corn', qty: 1, unit: 'lb', section: 'Frozen' },
      { name: 'BBQ sauce', qty: 1, unit: 'bottle', section: 'Pantry' },
    ],
    'Chicken quesadillas': [
      { name: 'Shredded cheese', qty: 1, unit: 'lb', section: 'Dairy' },
      { name: 'Tortillas', qty: 10, unit: 'ct', section: 'Bakery' },
    ],
    'Taco night': [
      { name: 'Taco shells', qty: 12, unit: 'ct', section: 'Pantry' },
      { name: 'Shredded lettuce', qty: 1, unit: 'bag', section: 'Produce' },
    ],
    'Chicken Caesar wraps': [
      { name: 'Wraps', qty: 8, unit: 'ct', section: 'Bakery' },
      { name: 'Romaine', qty: 2, unit: 'head', section: 'Produce' },
      { name: 'Caesar dressing', qty: 1, unit: 'bottle', section: 'Pantry' },
    ],
    'Spaghetti & meatballs': [
      { name: 'Spaghetti', qty: 2, unit: 'lb', section: 'Pantry' },
    ],
    'Alfredo pasta': [
      { name: 'Fettuccine', qty: 2, unit: 'lb', section: 'Pantry' },
    ],
    'Meatball subs': [
      { name: 'Sub rolls', qty: 6, unit: 'ct', section: 'Bakery' },
      { name: 'Provolone', qty: 12, unit: 'slice', section: 'Dairy' },
    ],
    'Chicken & broccoli alfredo': [
      { name: 'Broccoli florets', qty: 1, unit: 'lb', section: 'Produce' },
      { name: 'Chicken breast', qty: 2, unit: 'lb', section: 'Meat' },
    ],
    'Pizza night': [
      { name: 'Frozen pizza', qty: 2, unit: 'ct', section: 'Frozen' },
    ],
    'Leftovers': [],
    'Free night': [],
  }
  const items: Item[] = []
  for (const t of titles){
    const arr = map[t] || []
    items.push(...arr)
  }
  return items
}

// Lightweight confetti
function confettiLite(){
  if (typeof window === 'undefined') return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) return
  const frag = document.createDocumentFragment()
  for (let i=0;i<18;i++){
    const n = document.createElement('span')
    n.textContent = i%3===0?'✨':i%3===1?'🎈':'🎉'
    Object.assign(n.style, { position:'fixed', left: Math.random()*100+'vw', top:'-10px', transition:'transform 1000ms ease-out, opacity 1000ms ease-out', opacity:'0' })
    requestAnimationFrame(()=>{ n.style.opacity='1'; n.style.transform=`translateY(${95+Math.random()*15}vh) rotate(${(Math.random()-.5)*360}deg)` })
    setTimeout(()=> n.remove(), 1100)
    frag.appendChild(n)
  }
  document.body.appendChild(frag)
}
