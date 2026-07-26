<script setup lang="ts">
import type { FoodType, MenuItem } from '~/types/diet'

interface Restaurant {
  id: string
  name: string
}

interface RestaurantsResponse {
  restaurants: Array<Restaurant & { updatedAt: string }>
}

interface RestaurantSelectionResponse {
  serviceDate: string
  restaurant: Restaurant | null
}

interface EipMenuImportResult {
  restaurants: number
  imported: number
  inserted: number
  updated: number
  estimated: number
  fileHash?: string
}

interface EipMenuImportQueued {
  pending: true
  jobId: string
  statusUrl: string
  imported: number
  estimated: number
}

interface MenuDatabaseResponse {
  foodType: FoodType
  restaurantId: string | null
  restaurants: Restaurant[]
  items: Array<{
    id: string
    source: 'eip'
    restaurantId: string
    restaurantName: string
    name: string
    caloriesKcal: number
    proteinG: number | null
    fatG: number | null
    carbsG: number | null
    fiberG: number | null
    sodiumMg: number | null
    nutritionEstimated: boolean
    importedAt: string
  }>
}

const { goal, goalDescription, notify } = useDietApp()
const { todayDate, formatCalendarDate, formatTime } = useAppDate()
const foodType = ref<FoodType>('meat')
const serviceDate = ref(todayDate())
const restaurantSearch = ref('')
const selectedRestaurantId = ref<string | null>(null)
const selected = ref<MenuItem | null>(null)
const confirmationRequestId = ref('')
const confirmOpen = ref(false)
const syncing = ref(false)
const savingRestaurant = ref(false)
const savingSelection = ref(false)
const recommendationReady = ref(false)
const apiMenus = ref<MenuItem[]>([])
const importInput = ref<HTMLInputElement | null>(null)
const importStage = ref<'idle' | 'uploading' | 'estimating'>('idle')
const importing = computed(() => importStage.value !== 'idle')
const importButtonLabel = computed(() => importStage.value === 'estimating'
  ? 'AI 估算營養中'
  : importStage.value === 'uploading'
    ? '讀取檔案中'
    : '匯入餐廳菜單')
const { post, postForm, waitForJob, recommendLunch, confirmLunch } = useApi()

const { data: restaurantsData, refresh: refreshRestaurants } = await useFetch<RestaurantsResponse>('/api/eip/restaurants', {
  key: 'eip-restaurants'
})

const { data: selectionData } = await useFetch<RestaurantSelectionResponse>('/api/eip/restaurant-selection', {
  key: 'today-eip-restaurant-selection',
  query: { serviceDate }
})
selectedRestaurantId.value = selectionData.value?.restaurant?.id ?? null

const { data: menuData, refresh: refreshMenu } = await useFetch<MenuDatabaseResponse>('/api/eip/menu', {
  key: 'today-eip-menu',
  query: { restaurantId: selectedRestaurantId, foodType }
})

const restaurants = computed(() => restaurantsData.value?.restaurants ?? [])
const filteredRestaurants = computed(() => {
  const query = restaurantSearch.value.trim().toLocaleLowerCase('zh-Hant')
  return query
    ? restaurants.value.filter(restaurant => restaurant.name.toLocaleLowerCase('zh-Hant').includes(query))
    : restaurants.value
})
const selectedRestaurant = computed(() => restaurants.value.find(restaurant => restaurant.id === selectedRestaurantId.value) ?? null)

const databaseMenus = computed<MenuItem[]>(() => (menuData.value?.items ?? []).map(item => ({
  id: item.id,
  source: item.source,
  restaurantName: item.restaurantName,
  name: item.name,
  kcal: `${Math.round(item.caloriesKcal)} kcal`,
  reason: item.nutritionEstimated
    ? '營養數值含 AI 單人份估算；按下推薦後，會依你的需求挑選餐點'
    : '按下推薦後，會依你的需求挑選餐點',
  rank: null,
  protein: item.proteinG === null ? '資料不足' : `${item.proteinG} g`,
  vegetable: '目前未提供蔬菜份數',
  nutrients: {
    caloriesKcal: item.caloriesKcal,
    proteinG: item.proteinG,
    fatG: item.fatG,
    carbsG: item.carbsG,
    fiberG: item.fiberG,
    sodiumMg: item.sodiumMg
  }
})))

const displayedMenus = computed(() => recommendationReady.value ? apiMenus.value : databaseMenus.value)
const lastImportedAt = computed(() => {
  const latest = menuData.value?.items[0]?.importedAt
  return latest ? `${formatCalendarDate(latest)} ${formatTime(latest)}` : '尚無匯入紀錄'
})
const menuDescription = computed(() => recommendationReady.value
  ? selectedRestaurant.value
    ? `只會推薦「${selectedRestaurant.value.name}」的餐點`
    : '未指定餐廳，將從所有餐廳的菜單中推薦。'
  : selectedRestaurant.value
    ? `目前顯示「${selectedRestaurant.value.name}」的菜單；按下推薦後，會依你的需求挑選餐點。`
    : '目前顯示所有餐廳的菜單；按下推薦後，會依你的需求挑選餐點。')

watch(foodType, async () => {
  resetRecommendation()
  await refreshMenu()
})

function resetRecommendation() {
  apiMenus.value = []
  recommendationReady.value = false
  selected.value = null
  confirmOpen.value = false
}

async function chooseRestaurant(restaurantId: string | null) {
  if (savingRestaurant.value || selectedRestaurantId.value === restaurantId) return
  savingRestaurant.value = true
  try {
    await post('/api/eip/restaurant-selection', {
      serviceDate: serviceDate.value,
      restaurantId
    })
    selectedRestaurantId.value = restaurantId
    resetRecommendation()
    await refreshMenu()
    notify(restaurantId
      ? `今日餐廳已選擇：${selectedRestaurant.value?.name ?? '已選餐廳'}`
      : '已清除今日餐廳，推薦時會搜尋全部餐廳')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '餐廳選擇儲存失敗')
  } finally {
    savingRestaurant.value = false
  }
}

function choose(item: MenuItem) {
  selected.value = item
  confirmationRequestId.value = crypto.randomUUID()
  confirmOpen.value = true
}

async function confirm() {
  if (!selected.value || savingSelection.value) return
  savingSelection.value = true
  try {
    const result = await confirmLunch(
      selected.value.id,
      foodType.value,
      serviceDate.value,
      confirmationRequestId.value,
      selectedRestaurantId.value
    ) as { duplicate?: boolean }
    confirmOpen.value = false
    notify(result.duplicate
      ? `${selected.value.name}已存在今日午餐紀錄`
      : `${selected.value.name}已加入今天的午餐紀錄`)
    await refreshNuxtData('meal-summary')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '午餐紀錄儲存失敗')
  } finally {
    savingSelection.value = false
  }
}

async function syncEip() {
  if (!navigator.onLine) {
    notify('目前沒有網路，先顯示已載入的菜單。')
    return
  }
  syncing.value = true
  const requestedFoodType = foodType.value
  try {
    const requestedRestaurantId = selectedRestaurantId.value
    const response = await recommendLunch(goal.value, requestedFoodType, false, serviceDate.value, requestedRestaurantId)
    if (foodType.value !== requestedFoodType) return
    const byId = new Map(response.candidates.map(item => [item.id, item]))
    apiMenus.value = response.output.candidateIds.flatMap((id, index) => {
      const item = byId.get(id)
      if (!item) return []
      return [{
        id: item.id,
        source: item.source,
        restaurantName: item.restaurantName ?? null,
        name: item.name,
        kcal: `${Math.round(item.caloriesKcal)} kcal`,
        reason: response.output.reasonById[id] ?? '符合目前條件',
        rank: index + 1,
        protein: item.proteinG === null ? '資料不足' : `${item.proteinG} g`,
        vegetable: '目前未提供蔬菜份數',
        nutrients: {
          caloriesKcal: item.caloriesKcal,
          proteinG: item.proteinG,
          fatG: item.fatG,
          carbsG: item.carbsG,
          fiberG: null,
          sodiumMg: null
        }
      }]
    })
    recommendationReady.value = true
    notify(response.warning ?? (requestedRestaurantId
      ? `已依「${selectedRestaurant.value?.name ?? '所選餐廳'}」菜單完成推薦`
      : '未選餐廳，已從所有餐廳的菜單中完成推薦'))
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '目前無法推薦餐點，請先確認菜單中有可選的餐點。')
  } finally {
    syncing.value = false
  }
}

async function importEipMenu(file?: File) {
  if (!file) return
  importStage.value = 'uploading'
  try {
    const form = new FormData()
    form.append('file', file)
    const response = await postForm<EipMenuImportResult | EipMenuImportQueued>('/api/eip/menu/import', form)
    let result: EipMenuImportResult
    if ('statusUrl' in response) {
      importStage.value = 'estimating'
      notify(`檔案已讀取，AI 正在估算 ${response.estimated} 筆缺少的營養數值`)
      result = await waitForJob<EipMenuImportResult>(response.statusUrl, 360_000)
    } else {
      result = response
    }
    notify(`菜單匯入完成：新增 ${result.inserted} 筆、更新 ${result.updated} 筆${result.estimated ? `；AI 估算 ${result.estimated} 筆` : ''}`)
    await refreshRestaurants()
    await refreshMenu()
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : 'EIP 菜單匯入失敗；請確認每列都有餐廳名稱與餐點名稱')
  } finally {
    importStage.value = 'idle'
    if (importInput.value) importInput.value.value = ''
  }
}

useSeoMeta({ title: '午餐推薦｜一食之選' })
</script>

<template>
  <div class="recommend-page">
    <PageHeading title="午餐推薦" description="依餐廳菜單、近期飲食紀錄和營養資料推薦餐點">
      <div class="heading-actions">
        <button type="button" class="button button--secondary button--small" :disabled="importing" @click="importInput?.click()"><Icon :name="importing ? 'svg-spinners:ring-resize' : 'solar:upload-linear'" />{{ importButtonLabel }}</button>
        <input ref="importInput" class="visually-hidden" type="file" accept=".csv,.xlsx,.xls" @change="importEipMenu(($event.target as HTMLInputElement).files?.[0])">
        <button type="button" class="button button--primary button--small" :disabled="syncing" @click="syncEip">
          <Icon :name="syncing ? 'svg-spinners:ring-resize' : 'solar:refresh-linear'" />{{ syncing ? '推薦中' : selectedRestaurant ? '推薦此餐廳餐點' : '跨餐廳推薦' }}
        </button>
      </div>
    </PageHeading>

    <section class="goal-strip">
      <span><Icon name="solar:target-linear" /></span>
      <div><b>今日策略推薦</b><p>{{ goalDescription }}</p></div>
      <strong>{{ goal }}</strong>
      <NuxtLink to="/profile#goal">調整</NuxtLink>
    </section>

    <p v-if="recommendationReady" class="recommendation-source">
      <Icon name="solar:verified-check-linear" />
      推薦結果已參考餐廳菜單、近 7 日飲食紀錄和你的飲食目標
    </p>

    <section class="restaurant-picker" aria-labelledby="restaurant-picker-title">
      <div class="restaurant-picker__head">
        <div>
          <span>今日餐廳</span>
          <h2 id="restaurant-picker-title">{{ selectedRestaurant?.name ?? '尚未指定餐廳' }}</h2>
          <p>選定後只推薦該餐廳餐點；不指定時可跨全部餐廳取得建議。</p>
        </div>
        <strong>{{ serviceDate }}</strong>
      </div>
      <label class="restaurant-search">
        <Icon name="solar:magnifer-linear" />
        <input v-model="restaurantSearch" type="search" placeholder="搜尋餐廳名稱" autocomplete="off">
      </label>
      <div class="restaurant-options" role="listbox" aria-label="選擇今日餐廳">
        <button
          type="button"
          role="option"
          :aria-selected="selectedRestaurantId === null"
          :class="{ active: selectedRestaurantId === null }"
          :disabled="savingRestaurant"
          @click="chooseRestaurant(null)"
        >全部餐廳</button>
        <button
          v-for="restaurant in filteredRestaurants"
          :key="restaurant.id"
          type="button"
          role="option"
          :aria-selected="selectedRestaurantId === restaurant.id"
          :class="{ active: selectedRestaurantId === restaurant.id }"
          :disabled="savingRestaurant"
          @click="chooseRestaurant(restaurant.id)"
        >{{ restaurant.name }}</button>
      </div>
      <p v-if="restaurantSearch && !filteredRestaurants.length" class="empty-note">找不到符合「{{ restaurantSearch }}」的餐廳。</p>
    </section>

    <div class="food-type-tabs" role="tablist">
      <button type="button" :class="{ active: foodType === 'meat' }" @click="foodType = 'meat'">葷食</button>
      <button type="button" :class="{ active: foodType === 'veg' }" @click="foodType = 'veg'">素食</button>
    </div>

    <section class="vendor-card">
      <div class="vendor-card__head"><div><span>餐廳菜單</span><h2>{{ selectedRestaurant?.name ?? '全部餐廳' }}</h2><p>再次匯入同一家餐廳的同名餐點時，會更新原本內容，不會多出重複餐點。</p></div><strong>{{ foodType === 'veg' ? '素食' : '葷食／未分類' }}</strong></div>
      <dl><div><dt>今日選擇</dt><dd>{{ selectedRestaurant?.name ?? '跨餐廳建議' }}</dd></div><div><dt>餐點</dt><dd>有 {{ menuData?.items.length ?? 0 }} 個</dd></div><div><dt>最後更新</dt><dd>{{ lastImportedAt }}</dd></div></dl>
    </section>

    <SectionHeading title="本日菜單" :description="menuDescription" />
    <TransitionGroup v-if="displayedMenus.length" name="menu" tag="div" class="menu-grid">
      <MenuCard v-for="item in displayedMenus" :key="item.id" :item="item" :selected="selected?.id === item.id" @select="choose(item)" />
    </TransitionGroup>
    <p v-else class="empty-note">{{ selectedRestaurant ? `「${selectedRestaurant.name}」目前沒有符合葷／素分類的餐點。` : '目前找不到符合條件的餐點。你可以先匯入菜單，或清除餐廳選擇後再試一次。' }}</p>
    <p class="eip-note"><Icon name="solar:info-circle-linear" /> 每筆菜單只要填寫餐廳名稱和餐點名稱即可。營養數值可以留空；系統會保留已填寫的內容，再由 AI 補上缺少的估算值。這些數值以一般單人份量估算，僅供飲食記錄參考。再次匯入同一家餐廳的同名餐點時，會更新原本內容，不會重複新增。</p>
    <MealConfirmDialog :open="confirmOpen" :item="selected" :saving="savingSelection" @close="confirmOpen = false" @confirm="confirm" />
  </div>
</template>
