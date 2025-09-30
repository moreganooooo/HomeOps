// public/sw.js — Workbox-powered service worker with offline + background sync
/* eslint-disable no-undef */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.6.1/workbox-sw.js')
self.__WB_DISABLE_DEV_LOGS = true


workbox.setConfig({ debug: false })
workbox.core.setCacheNameDetails({ prefix: 'homeops', suffix: 'v1', precache: 'precache', runtime: 'runtime' })


// Enable navigation preload to speed up navigations
workbox.navigationPreload.enable()


// Precache just the offline shell page (we rely on runtime caching for Next assets)
workbox.precaching.precacheAndRoute([
{ url: '/offline.html', revision: '1' },
])


// Next.js hashed static assets → CacheFirst
workbox.routing.registerRoute(
({ url }) => url.pathname.startsWith('/_next/static/'),
new workbox.strategies.CacheFirst({
cacheName: 'next-static',
plugins: [new workbox.expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
}),
)


// Scripts & styles → StaleWhileRevalidate
workbox.routing.registerRoute(
({ request }) => request.destination === 'script' || request.destination === 'style',
new workbox.strategies.StaleWhileRevalidate({ cacheName: 'assets' }),
)


// Images → StaleWhileRevalidate with cap
workbox.routing.registerRoute(
({ request }) => request.destination === 'image',
new workbox.strategies.StaleWhileRevalidate({
cacheName: 'images',
plugins: [new workbox.expiration.ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 })],
}),
)


// App pages (navigations) → NetworkFirst with offline fallback
workbox.routing.registerRoute(
({ request }) => request.mode === 'navigate',
new workbox.strategies.NetworkFirst({ cacheName: 'pages', plugins: [new workbox.expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 })] }),
)


self.addEventListener('fetch', (event) => {
if (event.request.mode === 'navigate') {
event.respondWith(
(async () => {
try {
const preload = await event.preloadResponse
if (preload) return preload
return await fetch(event.request)
} catch (err) {
const cache = await caches.open('homeops-precache')
return (await cache.match('/offline.html')) || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } })
}
})(),
)
}
})


// Background Sync for Worker subscribe/unsubscribe endpoints
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('push-subscribe-queue', { maxRetentionTime: 24 * 60 })


workbox.routing.registerRoute(
({ url, request }) => request.method === 'POST' && (url.pathname.endsWith('/subscribe') || url.pathname.endsWith('/unsubscribe')),
new workbox.strategies.NetworkOnly({ plugins: [bgSyncPlugin] }),
'POST',
)


// Push notifications (for Worker payloads)
self.addEventListener('push', (event) => {
try {
const data = event.data ? event.data.json() : { title: 'Home Ops', body: 'Reminder', url: '/today' }
event.waitUntil(
self.registration.showNotification(data.title || 'Home Ops', {
body: data.body || '',
data,
icon: '/icons/icon-192.png',
badge: '/icons/icon-192.png',
}),
)
} catch (e) {
// no-op
}
})


self.addEventListener('notificationclick', (event) => {
event.notification.close()
const url = event.notification.data?.url || '/today'
event.waitUntil(
self.clients.matchAll({ type: 'window' }).then((clients) => {
for (const c of clients) {
if ('focus' in c) return c.focus()
}
if (self.clients.openWindow) return self.clients.openWindow(url)
}),
)
})