/**
 * lib/groceries.ts
 * Utilities to build a clean, consolidated grocery list.
 *
 * Input items can be messy (mixed case, duplicate names, different units, no section).
 * We:
 *  - normalize names for matching (lowercase + trim + simple punctuation squash)
 *  - keep displayName from the first occurrence
 *  - normalize some common units ("count" → "ct", etc.)
 *  - infer a section from keywords if missing
 *  - merge quantities per (name, unit) pair
 *  - sort by section order, then name
 */

export type GroceryItemInput = { name: string; qty: number; unit?: string; section?: string }
export type GroceryItemOut = { name: string; qty: number; unit?: string; section: Section }

export type Section =
  | 'Produce'
  | 'Meat'
  | 'Dairy'
  | 'Bakery'
  | 'Pantry'
  | 'Frozen'
  | 'Household'
  | 'Other'

export const SECTION_ORDER: Section[] = [
  'Produce', 'Meat', 'Dairy', 'Bakery', 'Pantry', 'Frozen', 'Household', 'Other',
]

// Lightweight keyword map to guess store sections
const SECTION_KEYWORDS: Record<Section, string[]> = {
  Produce: ['apple','banana','lettuce','romaine','tomato','onion','garlic','carrot','cucumber','broccoli','pepper','lime','lemon','grape','avocado','spinach','cilantro','herb','veg','vegetable','fruit','potato'],
  Meat: ['chicken','beef','pork','sausage','ground','turkey','steak','ham','bacon'],
  Dairy: ['milk','yogurt','cheese','butter','cream','half','parmesan','provolone','sour','egg'],
  Bakery: ['bread','bun','roll','wrap','tortilla','pita','bagel','muffin','sub','brioche'],
  Pantry: ['rice','pasta','spaghetti','fettuccine','marinara','sauce','bbq','seasoning','spice','oil','vinegar','canned','beans','shells','stock','broth','taco','breadcrumbs','dressing'],
  Frozen: ['frozen','pizza','ice','bag','corn','veg','vegetable','berries'],
  Household: ['foil','zip','ziplock','bag','soap','detergent','cleaner','trash','liner','towel','napkin','sponge','paper'],
  Other: [],
}

const UNIT_ALIASES: Record<string, string> = {
  count: 'ct', ct: 'ct', piece: 'ct', pieces: 'ct', pcs: 'ct', pc: 'ct',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  jar: 'jar', jars: 'jar', bottle: 'bottle', bottles: 'bottle', can: 'can', cans: 'can',
  cup: 'cup', cups: 'cup', pt: 'pt', pint: 'pt', q: 'qt', qt: 'qt', quart: 'qt', gal: 'gal', gallon: 'gal', tbsp: 'tbsp', tsp: 'tsp',
}

function normalizeUnit(u?: string){
  if (!u) return undefined
  const base = u.trim().toLowerCase()
  return UNIT_ALIASES[base] || u
}

function normalizeKeyName(name: string){
  // lowercase, trim, collapse spaces, strip some punctuation
  return name
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9&+\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickDisplayName(a: string, b: string){
  // Prefer the first, but upgrade to a nicer-cased version if b looks significantly better
  // Simple heuristic: if a is all lower and b has any capitals, use b
  const aHasCaps = /[A-Z]/.test(a)
  const bHasCaps = /[A-Z]/.test(b)
  if (!aHasCaps && bHasCaps) return b
  return a
}

export function guessSection(name: string): Section {
  const key = normalizeKeyName(name)
  for (const sec of SECTION_ORDER){
    const needles = SECTION_KEYWORDS[sec]
    for (const k of needles){ if (key.includes(k)) return sec }
  }
  return 'Other'
}

/**
 * Merge items by (normalizedName, normalizedUnit). If section is missing, infer it.
 */
export function consolidate(items: GroceryItemInput[]): GroceryItemOut[] {
  const map = new Map<string, GroceryItemOut>()

  for (const raw of items){
    if (!raw || !raw.name || !isFinite(raw.qty as number)) continue

    const unit = normalizeUnit(raw.unit)
    const normName = normalizeKeyName(raw.name)
    const key = `${normName}|${unit || ''}`

    const nextSection: Section = (raw.section as Section) || guessSection(raw.name)

    if (map.has(key)){
      const cur = map.get(key)!
      cur.qty += Number(raw.qty)
      // keep earlier section unless we only had Other and the new guess is better
      if (cur.section === 'Other' && nextSection !== 'Other') cur.section = nextSection
      // pick a nicer display name if available
      cur.name = pickDisplayName(cur.name, raw.name)
    } else {
      map.set(key, {
        name: raw.name.trim(),
        qty: Number(raw.qty),
        unit,
        section: nextSection,
      })
    }
  }

  const out = Array.from(map.values())
  out.sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.section)
    const bi = SECTION_ORDER.indexOf(b.section)
    if (ai !== bi) return ai - bi
    return a.name.localeCompare(b.name)
  })
  return out
}

// Convenience: split into per-section buckets (useful for print views)
export function bucketBySection(items: GroceryItemOut[]): Record<Section, GroceryItemOut[]> {
  const buckets = Object.fromEntries(SECTION_ORDER.map(s => [s, [] as GroceryItemOut[]])) as Record<Section, GroceryItemOut[]>
  for (const it of items){ buckets[it.section].push(it) }
  for (const s of SECTION_ORDER){ buckets[s].sort((a,b)=> a.name.localeCompare(b.name)) }
  return buckets
}
