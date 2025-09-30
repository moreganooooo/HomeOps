// lib/sw-register.ts — register SW globally + handle updates
export function registerSW(){
if (typeof window === 'undefined') return
if (!('serviceWorker' in navigator)) return
window.addEventListener('load', () => {
navigator.serviceWorker.register('/sw.js').then((reg) => {
// Auto-activate updates
reg.addEventListener('updatefound', () => {
const newWorker = reg.installing
if (!newWorker) return
newWorker.addEventListener('statechange', () => {
if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
newWorker.postMessage({ type: 'SKIP_WAITING' })
}
})
})
}).catch(()=>{})
})
}