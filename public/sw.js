// public/sw.js — tiny service worker (placeholder for push)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('push', (event) => {
const data = event.data ? event.data.json() : { title:'Home Ops', body:'Reminder', url:'/today' }
event.waitUntil(self.registration.showNotification(data.title || 'Home Ops', { body: data.body || '', data, icon: '/icons/icon-192.png' }))
})
self.addEventListener('notificationclick', (event) => {
event.notification.close()
const url = event.notification.data?.url || '/today'
event.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
for (const c of clients){ if ('focus' in c) return (c as any).focus() }
if (self.clients.openWindow) return self.clients.openWindow(url)
}))
})