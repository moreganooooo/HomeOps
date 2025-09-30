// app/print/fridge/page.tsx — ink‑friendly fridge view
const sow = useMemo(() => (prefs?.startOfWeek ?? 1) as 0|1|2|3|4|5|6, [prefs])
const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: sow }), [now, sow])
const weekStartStr = useMemo(() => format(weekStart, 'yyyy-MM-dd'), [weekStart])
const isoWeek = useMemo(() => getISOWeek(weekStart), [weekStart])


const owner = useMemo(() => ownerFor(now), [now])


const [weeklyReset, setWeeklyReset] = useState<string[]>([
'Laundry reset','Clear kitchen surfaces','Vacuum high‑traffic','Plan week'
])


useEffect(() => {
let mounted = true
;(async () => {
const p = (await db.prefs.get('prefs')) || { startOfWeek: 1, zoneIndex: undefined }
const zs = await db.zones.toArray().catch(()=> [])
if (mounted){ setPrefs(p); setZones(zs.length ? zs : DEFAULT_ZONES) }
})().finally(()=> mounted && setLoading(false))
return () => { mounted = false }
}, [])


if (loading) return <div className="p-6">Loading…</div>


const zIdx = (typeof prefs?.zoneIndex === 'number' ? (prefs!.zoneIndex as number) : isoWeek) % zones.length
const zone = zones[zIdx]


return (
<div className="p-6 print:p-4">
<header className="mb-3">
<h1 className="text-2xl font-extrabold">Fridge Grid</h1>
<div className="text-sm text-gray-600">Week of {format(weekStart, 'EEE, MMM d')}</div>
<div className="no-print mt-2"><Link href="/chores" className="card inline-block px-3 h-10">Back</Link></div>
</header>


{/* Dishes / Litter */}
<section className="mb-4 break-inside-avoid-page">
<h2 className="font-bold border-b pb-1 mb-2">Today’s Chores</h2>
<ul className="grid grid-cols-1 gap-1 text-base">
<li>□ Do Dishes — {prettyOwner(owner)}</li>
<li>□ Scoop Litter — {prettyOwner(owner)}</li>
<li className="text-xs text-gray-600 mt-1">{eliUnloads(now) ? 'Eli unloads today (Mon–Fri)' : '\u00A0'}</li>
</ul>
</section>


{/* Weekly Reset */}
<section className="mb-4 break-inside-avoid-page">
<h2 className="font-bold border-b pb-1 mb-2">Weekly Reset (Sunday)</h2>
<ul className="grid grid-cols-1 gap-1 text-base">
{weeklyReset.map((label, i) => <li key={i}>□ {label}</li>)}
</ul>
</section>


{/* Zone of the Week */}
<section className="mb-4 break-inside-avoid-page">
<h2 className="font-bold border-b pb-1 mb-2">Zone of the Week</h2>
<div className="font-semibold mb-1">{zone?.name || 'Zone'}</div>
<ul className="grid grid-cols-1 gap-1 text-base">
{(zone?.subtasks || []).length
? zone.subtasks.map((s, i) => <li key={i}>□ {s}</li>)
: <li className="text-sm text-gray-600">Add subtasks in Settings</li>
}
</ul>
</section>


<style jsx global>{`
@media print { body { font-size: 12pt; } h1 { font-size: 20pt } h2 { font-size: 14pt } }
`}</style>
</div>
)
}


function prettyOwner(o: string){ return o === 'you' ? 'You' : o === 'dom' ? 'Dom' : o }


const DEFAULT_ZONES: Zone[] = [
{ id: 'zone-kitchen', name: 'Kitchen', subtasks: ['Wipe fronts','Microwave','Sink scrub','Fridge quick sort'] },
{ id: 'zone-bath', name: 'Bathrooms', subtasks: ['Toilets','Sinks','Counters & mirrors','Tubs/showers'] },
{ id: 'zone-floors', name: 'Floors', subtasks: ['Entry','Kitchen','Hallway','Living room'] },
{ id: 'zone-laundry', name: 'Laundry', subtasks: ['Baskets sorted','Run loads','Fold 15 min'] },
{ id: 'zone-entry', name: 'Entry/Car', subtasks: ['Shoe rack','Mail sort','Trash from car'] },
{ id: 'zone-bed', name: 'Bedrooms', subtasks: ['Nightstands','Clothes off floor','Change sheets'] },
]


type Zone = { id: string; name: string; subtasks: string[] }