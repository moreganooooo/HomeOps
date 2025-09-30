// app/settings/page.tsx
{members.map(m => (
<li key={m.id} className="grid grid-cols-1 gap-2">
<div className="grid grid-cols-3 gap-2">
<input className="h-12 rounded-2xl border px-3 col-span-2" value={m.name} onChange={e=> updateMember(m.id, { name: e.target.value })} />
<input className="h-12 rounded-2xl border px-3" type="color" value={m.color} onChange={e=> updateMember(m.id, { color: e.target.value })} />
</div>
<div className="flex gap-2">
<button className="card h-10 px-3" onClick={()=> removeMember(m.id)}>Remove</button>
</div>
</li>
))}
</ul>
<div className="mt-3">
<button className="primary" onClick={saveMembers}>Save Members</button>
</div>
</section>


{/* Zones */}
<section className="card">
<div className="flex items-center justify-between">
<h2 className="text-xl font-bold">Zones</h2>
<button className="card h-10 px-3" onClick={addZone}>Add Zone</button>
</div>
<ul className="mt-2 space-y-4">
{zones.map(z => (
<li key={z.id} className="grid gap-2">
<input className="h-12 rounded-2xl border px-3" value={z.name} onChange={e=> updateZone(z.id, { name: e.target.value })} />
<div className="grid gap-2">
{(z.subtasks||[]).map((s, i) => (
<div key={i} className="flex items-center gap-2">
<input className="flex-1 h-12 rounded-2xl border px-3" value={s} onChange={e=> updateSubtask(z, i, e.target.value)} />
<button className="card h-10 px-3" onClick={()=> removeSubtask(z, i)}>Remove</button>
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
<div className="mt-3">
<button className="primary" onClick={saveZones}>Save Zones</button>
</div>
</section>
</div>
)
}