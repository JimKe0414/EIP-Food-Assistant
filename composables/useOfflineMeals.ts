import type { MealInput } from '~/shared/domain/meals'

const DB_NAME = 'first-choice-offline'
const STORE_NAME = 'pending_meals'

export function useOfflineMeals() {
  const pendingCount = useState('pending-meal-count', () => 0)
  const { post } = useApi()

  async function queueMeal(payload: MealInput) {
    if (!import.meta.client) return
    const database = await openDatabase()
    await requestPromise(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
      id: crypto.randomUUID(), payload, attempts: 0, createdAt: new Date().toISOString()
    }))
    database.close()
    await refreshCount()
    const registration = await navigator.serviceWorker?.ready
    if (registration && 'sync' in registration) {
      await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register('sync-meals')
    }
  }

  async function refreshCount() {
    if (!import.meta.client) return
    const database = await openDatabase()
    pendingCount.value = Number(await requestPromise(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count()))
    database.close()
  }

  async function retryInForeground() {
    if (!navigator.onLine) return
    await refreshCount()
    if (!pendingCount.value) return
    const registration = await navigator.serviceWorker?.ready
    if (registration && 'sync' in registration) {
      await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register('sync-meals')
      return
    }

    const database = await openDatabase()
    const entries = await requestPromise<PendingMeal[]>(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll())
    database.close()
    for (const entry of entries) {
      if (entry.attempts >= 3) continue
      try {
        await post('/api/meals', entry.payload)
        await mutateEntry('delete', entry.id)
      } catch {
        await mutateEntry('put', { ...entry, attempts: entry.attempts + 1 })
      }
    }
    await refreshCount()
  }

  onMounted(() => {
    refreshCount()
    window.addEventListener('online', retryInForeground)
    navigator.serviceWorker?.addEventListener('message', refreshCount)
  })
  onBeforeUnmount(() => window.removeEventListener('online', retryInForeground))

  return { pendingCount, queueMeal, refreshCount }
}

interface PendingMeal { id: string, payload: MealInput, attempts: number, createdAt: string }

async function mutateEntry(mode: 'delete', value: string): Promise<void>
async function mutateEntry(mode: 'put', value: PendingMeal): Promise<void>
async function mutateEntry(mode: 'delete' | 'put', value: string | PendingMeal) {
  const database = await openDatabase()
  const store = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
  if (mode === 'delete') await requestPromise(store.delete(value as string))
  else await requestPromise(store.put(value as PendingMeal))
  database.close()
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
