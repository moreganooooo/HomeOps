// lib/db.ts (full schema: matches spec + components)
import Dexie, { Table } from 'dexie'


export interface Member { id: string; name: string; color: string; role?: string; isChild?: boolean }
export interface Prefs { id: 'prefs'; timezone: string; startOfWeek: number; activeWeekType: 1|2; zoneIndex: number }
export interface Zone { id: string; name: string; subtasks: string[] }
export interface Checkmark { id: string; date: string; key: string; memberId?: string; doneAt: number }
export interface MealWeek { weekStart: string; weekType: 1|2; sundayPrepDone: boolean; doneAt?: number }
export interface DinnerCard { id: string; weekStart: string; day: string; title: string; notes?: string }
export interface GroceryItem { id: string; weekStart: string; name: string; qty: number; unit?: string; section?: string; checked?: boolean }
export interface LunchPlan { id: string; weekType: 1|2; day: string; item: string }


export class HomeOpsDB extends Dexie {
members!: Table<Member, string>
prefs!: Table<Prefs, string>
zones!: Table<Zone, string>
checkmarks!: Table<Checkmark, string>
mealWeeks!: Table<MealWeek, string>
dinnerCards!: Table<DinnerCard, string>
groceries!: Table<GroceryItem, string>
lunches!: Table<LunchPlan, string>


constructor(){
super('homeOps')
this.version(1).stores({
members: 'id',
prefs: 'id',
zones: 'id',
checkmarks: 'id,date',
mealWeeks: 'weekStart',
dinnerCards: 'id,weekStart,day',
groceries: 'id,weekStart',
lunches: 'id,weekType,day',
})
}
}


export const db = new HomeOpsDB()