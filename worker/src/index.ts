/// <reference lib="webworker" />
/// <reference types="@cloudflare/workers-types" />
// Routes:
//   GET  /auth        → redirect to Google OAuth consent
//   GET  /callback    → OAuth redirect; stores refresh token in KV
//   GET  /status      → { connected: boolean }
//   POST /events/upsert  → ensures Trash Night + Sunday Prep recurring events exist (or updates them)
//
// KV binding required: HOMEOPS_KV
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
// Optional env: CALENDAR_ID (defaults to 'primary')

export interface Env {
  HOMEOPS_KV: KVNamespace
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string
  CALENDAR_ID?: string
}

interface UpsertPayload {
  timezone?: string
  origin?: string
  trash?: Partial<Slot>
  sunday?: Partial<Slot>
  calendarId?: string
}

const OAUTH_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname.replace(/\/$/, '')

    if (p === '/auth') return handleAuth(url, env)
    if (p === '/callback') return handleCallback(url, env)
    if (p === '/status') return handleStatus(env)
    if (p === '/events/upsert' && req.method === 'POST') return handleUpsert(req, env)

    return new Response('Not found', { status: 404 })
  },
}

async function handleAuth(url: URL, env: Env) {
  const state = crypto.randomUUID()
  const forward = url.searchParams.get('forward') || ''
  await env.HOMEOPS_KV.put(`oauth_state:${state}`, forward, { expirationTtl: 600 })
  const authUrl = new URL(OAUTH_AUTH)
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('access_type', 'offline') // get refresh_token
  authUrl.searchParams.set('prompt', 'consent') // ensure refresh_token first time
  authUrl.searchParams.set('state', state)
  return Response.redirect(authUrl.toString(), 302)
}

async function handleCallback(url: URL, env: Env) {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return new Response('Missing code/state', { status: 400 })

  const forward = (await env.HOMEOPS_KV.get(`oauth_state:${state}`)) || ''
  await env.HOMEOPS_KV.delete(`oauth_state:${state}`)

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  })
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!r.ok) return new Response(`Token exchange failed: ${await r.text()}`, { status: 500 })
  const json: any = await r.json()
  const refresh = json.refresh_token as string | undefined
  if (refresh) await env.HOMEOPS_KV.put('google_refresh_token', refresh)
  // We don't store access tokens — we refresh on demand.

  const dest = forward || '/settings'
  return new Response(`<meta http-equiv="refresh" content="0;url=${escapeHtml(dest)}"><p>Connected. Returning to app…</p>`, { headers: { 'content-type': 'text/html' } })
}

async function handleStatus(env: Env) {
  const refresh = await env.HOMEOPS_KV.get('google_refresh_token')
  return json({ connected: Boolean(refresh) })
}

async function handleUpsert(req: Request, env: Env) {
  const { timezone, origin, trash, sunday, calendarId } = (await safeJSON(req)) as UpsertPayload
  const refresh = await env.HOMEOPS_KV.get('google_refresh_token')
  if (!refresh) return json({ error: 'not_connected' }, 400)
  const access = await refreshAccessToken(env, refresh)

  const calId = calendarId || env.CALENDAR_ID || 'primary'
  const tz = timezone || 'America/New_York'

  const trashConf = normalizeSlot(trash, { dow: 'TH', hour: 19, minute: 55, durationMin: 35, reminderMin: 5, summary: 'Trash Night', urlPath: '/today', description: 'Five quick steps. Badge clears Fri 9:00 AM.' })
  const sundayConf = normalizeSlot(sunday, { dow: 'SU', hour: 11, minute: 0, durationMin: 60, reminderMin: 15, summary: 'Sunday Prep', urlPath: '/meals', description: 'Prefill week + generate groceries.' })

  // Upsert events
  const t = await upsertRecurring(env, access, calId, tz, 'trash-night', trashConf, origin)
  const s = await upsertRecurring(env, access, calId, tz, 'sunday-prep', sundayConf, origin)

  return json({ ok: true, createdOrUpdated: { trash: t, sunday: s } })
}

async function upsertRecurring(env: Env, access: string, calId: string, tz: string, key: 'trash-night'|'sunday-prep', cfg: Slot, origin?: string) {
  const listUrl = new URL(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events`)
  listUrl.searchParams.set('maxResults', '10')
  listUrl.searchParams.set('privateExtendedProperty', `homeopsKey=${key}`)
  const list = await fetch(listUrl, { headers: { Authorization: `Bearer ${access}` } })
  const json: any = await list.json()
  const existing = json.items?.[0]

  const start = nextDowLocal(new Date(), cfg.dow, cfg.hour, cfg.minute, tz)
  const end = new Date(start.getTime() + cfg.durationMin * 60000)

  const payload: any = {
    summary: cfg.summary,
    description: `${cfg.description}\nOpen: ${origin || ''}${cfg.urlPath}`.trim(),
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${cfg.dow}`],
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: cfg.reminderMin }] },
    source: origin ? { title: 'Home Ops', url: origin } : undefined,
    extendedProperties: { private: { homeopsKey: key } },
  }

  if (existing) {
    const patchUrl = `${CAL_API}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(existing.id)}`
    const r = await fetch(patchUrl, { method: 'PATCH', headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    if (!r.ok) throw new Error(`Update failed: ${await r.text()}`)
    return 'updated'
  } else {
    const insertUrl = `${CAL_API}/calendars/${encodeURIComponent(calId)}/events`
    const r = await fetch(insertUrl, { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    if (!r.ok) throw new Error(`Create failed: ${await r.text()}`)
    return 'created'
  }
}

async function refreshAccessToken(env: Env, refresh: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refresh,
    grant_type: 'refresh_token',
  })
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!r.ok) throw new Error(`Refresh failed: ${await r.text()}`)
  const json: any = await r.json()
  return json.access_token as string
}

// ---- types & helpers ----

type Slot = { dow: 'SU'|'MO'|'TU'|'WE'|'TH'|'FR'|'SA'; hour: number; minute: number; durationMin: number; reminderMin: number; summary: string; description: string; urlPath: string }

function normalizeSlot(input: any, defaults: Slot): Slot {
  return {
    dow: (input?.dow || defaults.dow) as Slot['dow'],
    hour: Number(isFinite(input?.hour) ? input.hour : defaults.hour),
    minute: Number(isFinite(input?.minute) ? input.minute : defaults.minute),
    durationMin: Number(isFinite(input?.durationMin) ? input.durationMin : defaults.durationMin),
    reminderMin: Number(isFinite(input?.reminderMin) ? input.reminderMin : defaults.reminderMin),
    summary: String(input?.summary || defaults.summary),
    description: String(input?.description || defaults.description),
    urlPath: String(input?.urlPath || defaults.urlPath),
  }
}

function nextDowLocal(from: Date, dow: Slot['dow'], hour: number, minute: number, tz: string) {
  // Compute next occurrence in the given TZ by adjusting in UTC — good enough for weekly rules
  const targetDow = ['SU','MO','TU','WE','TH','FR','SA'].indexOf(dow)
  const d = new Date(from)
  const delta = (targetDow - d.getUTCDay() + 7) % 7 || (from.getUTCHours()*60 + from.getUTCMinutes() >= hour*60 + minute ? 7 : 0)
  d.setUTCDate(d.getUTCDate() + delta)
  d.setUTCHours(hour, minute, 0, 0)
  return d
}

async function safeJSON(req: Request){ try { return await req.json() } catch { return {} } }
function json(obj: unknown, status = 200){ return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } }) }
function escapeHtml(s: string){ return s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]!)) }
