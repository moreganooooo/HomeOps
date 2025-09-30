// lib/push.ts — minimal push helpers (works once a service worker exists)
export async function getPushStatus(){
if (typeof window === 'undefined') return { supported: false as const, permission: 'unknown' as const }
const supported = 'serviceWorker' in navigator && 'PushManager' in window
const permission = (Notification?.permission ?? 'default') as 'granted'|'denied'|'default'
return { supported, permission: permission === 'default' ? 'prompt' : permission }
}


export async function ensureServiceWorker(){
if (!('serviceWorker' in navigator)) throw new Error('Service worker not supported')
let reg = await navigator.serviceWorker.getRegistration()
if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
return reg
}


export async function subscribePush(){
const reg = await ensureServiceWorker()
const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC
if (!vapid) throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC')
const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) })
const url = process.env.NEXT_PUBLIC_WORKER_URL
if (url) {
await fetch(`${url}/subscribe`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(sub) }).catch(()=>{})
}
return sub
}


export async function unsubscribePush(){
const reg = await navigator.serviceWorker.getRegistration()
const sub = await reg?.pushManager.getSubscription()
if (sub){
try {
const url = process.env.NEXT_PUBLIC_WORKER_URL
if (url) await fetch(`${url}/unsubscribe`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(await sub.toJSON()) }).catch(()=>{})
} finally {
await sub.unsubscribe()
}
}
}


function urlBase64ToUint8Array(base64String: string) {
const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
const rawData = atob(base64)
const outputArray = new Uint8Array(rawData.length)
for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
return outputArray
}