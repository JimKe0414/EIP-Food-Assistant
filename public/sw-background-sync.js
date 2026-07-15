/* Custom text-meal queue used by the generated Workbox service worker. */
const DB_NAME = 'first-choice-offline'
const STORE_NAME = 'pending_meals'

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-meals') event.waitUntil(syncPendingMeals())
})

async function syncPendingMeals() {
  const pending = await readAll()
  let synced = 0
  for (const entry of pending) {
    if ((entry.attempts || 0) >= 3) continue
    try {
      const csrfResponse = await fetch('/api/csrf-token', { credentials: 'same-origin' })
      if (!csrfResponse.ok) throw new Error('csrf')
      const { token } = await csrfResponse.json()
      const response = await fetch('/api/meals', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(entry.payload)
      })
      if (!response.ok) throw new Error(`http-${response.status}`)
      await removeEntry(entry.id)
      synced += 1
    } catch {
      await updateAttempts(entry.id, (entry.attempts || 0) + 1)
    }
  }
  if (synced) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    clients.forEach(client => client.postMessage({ type: 'MEALS_SYNCED', count: synced }))
    if (self.Notification?.permission === 'granted') {
      await self.registration.showNotification('一食之選', { body: `${synced} 筆餐食記錄已同步`, icon: '/icons/icon-192.png' })
    }
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, action) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

function readAll() { return withStore('readonly', store => store.getAll()) }
function removeEntry(id) { return withStore('readwrite', store => store.delete(id)) }
async function updateAttempts(id, attempts) {
  const entry = await withStore('readonly', store => store.get(id))
  if (entry) await withStore('readwrite', store => store.put({ ...entry, attempts }))
}
