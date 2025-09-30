'use client'
import { useEffect } from 'react'
import { db } from '@/lib/db'

export default function Bootstrap(){
useEffect(() => {
(async () => {
// Prefs
const prefs = await db.prefs.get('prefs')
if (!prefs) {
await db.prefs.put({ id:'prefs', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York', startOfWeek: 1, activeWeekType: 1, zoneIndex: 0 })
}

// Members
const count = await db.members.count()
if (count === 0){
await db.members.bulkPut([
{ id:'you', name:'You', color:'#2563eb' },
{ id:'dom', name:'Dom', color:'#16a34a' },
{ id:'eli', name:'Eli', color:'#f59e0b', isChild: true },
])
}

// Zones (only if empty)
const zcount = await db.zones.count()
if (zcount === 0){
await db.zones.bulkPut([
{ id: 'zone-kitchen', name: 'Kitchen', subtasks: ['Wipe fronts','Microwave','Sink scrub','Fridge quick sort'] },
{ id: 'zone-bath', name: 'Bathrooms', subtasks: ['Toilets','Sinks','Counters & mirrors','Tubs/showers'] },
{ id: 'zone-floors', name: 'Floors', subtasks: ['Entry','Kitchen','Hallway','Living room'] },
{ id: 'zone-laundry', name: 'Laundry', subtasks: ['Baskets sorted','Run loads','Fold 15 min'] },
{ id: 'zone-entry', name: 'Entry/Car', subtasks: ['Shoe rack','Mail sort','Trash from car'] },
{ id: 'zone-bed', name: 'Bedrooms', subtasks: ['Nightstands','Clothes off floor','Change sheets'] },
])
}
})()
}, [])
return null
}