export function ownerFor(date: Date){
const d = Number(new Intl.DateTimeFormat('en-US',{day:'numeric'}).format(date))
return d % 2 ? 'you' : 'dom'
}
export function eliUnloads(date: Date){
const day = date.getDay() // 0..6, Sun..Sat
return day>=1 && day<=5
}


// lib/zones.ts
export function zoneIndexFor(isoWeek: number, zonesLen: number){
return isoWeek % zonesLen
}


// lib/groceries.ts (normalize & sum)
export function consolidate(items: {name:string, qty:number, unit?:string, section?:string}[]){
const map = new Map<string,{name:string, qty:number, unit?:string, section?:string}>()
for(const it of items){
const key = `${it.name.toLowerCase().trim()}|${it.unit||''}|${it.section||''}`
const cur = map.get(key)
map.set(key, cur? {...cur, qty: cur.qty + it.qty} : {...it})
}
return [...map.values()]
}