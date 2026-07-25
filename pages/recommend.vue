<script setup lang="ts">
import type { FoodType, MenuItem } from '~/types/diet'

interface MenuDatabaseResponse {
  serviceDate: string
  foodType: FoodType
  vendorNames: string[]
  items: Array<{
    id: string
    source: 'eip'
    name: string
    caloriesKcal: number
    proteinG: number | null
    fatG: number | null
    carbsG: number | null
    fiberG: number | null
    sodiumMg: number | null
    importedAt: string
  }>
}

const { goal, goalDescription, notify } = useDietApp()
const { todayDate, formatCalendarDate, formatTime } = useAppDate()
const foodType = ref<FoodType>('meat')
const serviceDate = ref(todayDate())
const selected = ref<MenuItem | null>(null)
const confirmationRequestId = ref('')
const confirmOpen = ref(false)
const syncing = ref(false)
const savingSelection = ref(false)
const recommendationReady = ref(false)
const apiMenus = ref<MenuItem[]>([])
const importInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const { postForm, recommendLunch, confirmLunch } = useApi()

const { data: menuData, refresh: refreshMenu } = await useFetch<MenuDatabaseResponse>('/api/eip/menu', {
  key: 'today-eip-menu',
  query: { serviceDate, foodType }
})

const databaseMenus = computed<MenuItem[]>(() => (menuData.value?.items ?? []).map(item => ({
  id: item.id,
  source: item.source,
  name: item.name,
  kcal: `${Math.round(item.caloriesKcal)} kcal`,
  reason: '已由 EIP 菜單資料寫入 DB，尚未執行 AI 排序',
  rank: null,
  protein: item.proteinG === null ? '資料不足' : `${item.proteinG} g`,
  vegetable: '資料庫目前沒有蔬菜份數欄位',
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
const vendorName = computed(() => {
  const names = menuData.value?.vendorNames ?? []
  return names.length ? names.join('、') : '尚無今日 EIP 菜單'
})
const lastImportedAt = computed(() => {
  const latest = menuData.value?.items[0]?.importedAt
  return latest ? `${formatCalendarDate(latest)} ${formatTime(latest)}` : '尚無匯入紀錄'
})
const menuDescription = computed(() => recommendationReady.value
  ? 'AI 只在 DB 候選中排序；確認時伺服器會再次查 DB 後寫入餐食紀錄'
  : '顯示 DB 內今日 EIP 菜單；尚未排序')

watch(foodType, async () => {
  apiMenus.value = []
  recommendationReady.value = false
  selected.value = null
  confirmOpen.value = false
  await refreshMenu()
})

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
      confirmationRequestId.value
    ) as { duplicate?: boolean }
    confirmOpen.value = false
    notify(result.duplicate
      ? `${selected.value.name}已存在今日午餐紀錄`
      : `${selected.value.name}已寫入今日午餐紀錄`)
    await refreshNuxtData('meal-summary')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '午餐紀錄寫入失敗')
  } finally {
    savingSelection.value = false
  }
}

async function syncEip() {
  if (!navigator.onLine) {
    notify('推薦需要網路連線；目前只顯示 DB 中已載入的菜單')
    return
  }
  syncing.value = true
  const requestedFoodType = foodType.value
  try {
    const response = await recommendLunch(goal.value, requestedFoodType, false, serviceDate.value)
    if (foodType.value !== requestedFoodType) return
    const byId = new Map(response.candidates.map(item => [item.id, item]))
    apiMenus.value = response.output.candidateIds.flatMap((id, index) => {
      const item = byId.get(id)
      if (!item) return []
      return [{
        id: item.id,
        source: item.source,
        name: item.name,
        kcal: `${Math.round(item.caloriesKcal)} kcal`,
        reason: response.output.reasonById[id] ?? '符合目前條件',
        rank: index + 1,
        protein: item.proteinG === null ? '資料不足' : `${item.proteinG} g`,
        vegetable: '資料庫目前沒有蔬菜份數欄位',
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
    notify(response.warning ?? '已依 DB 候選與近期餐食紀錄完成推薦')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '無法取得即時推薦，請確認 DB 中已有可用候選')
  } finally {
    syncing.value = false
  }
}

async function importEip(file?: File) {
  if (!file) return
  importing.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const result = await postForm<{
      imported: number
      recordedMeals: number
      duplicate: boolean
    }>('/api/eip/import', form)
    notify(result.duplicate
      ? '這份 EIP 個人點餐檔已匯入過，未重複寫入'
      : `已匯入並記錄 ${result.recordedMeals} 筆個人點餐紀錄`)
    await refreshNuxtData('meal-summary')
  } catch {
    notify('EIP 匯入失敗；請確認欄位、身分與檔案大小')
  } finally {
    importing.value = false
    if (importInput.value) importInput.value.value = ''
  }
}

useSeoMeta({ title: '午餐推薦｜一食之選' })
</script>

<template>
  <div class="recommend-page">
    <PageHeading title="午餐推薦" description="候選、近期紀錄與營養數值皆以資料庫內容為準">
      <div class="heading-actions">
        <button type="button" class="button button--secondary button--small" :disabled="importing" @click="importInput?.click()"><Icon name="solar:upload-linear" />{{ importing ? '匯入中' : '匯入個人點餐紀錄' }}</button>
        <input ref="importInput" class="visually-hidden" type="file" accept=".csv,.xlsx,.xls" @change="importEip(($event.target as HTMLInputElement).files?.[0])">
        <button type="button" class="button button--primary button--small" :disabled="syncing" @click="syncEip">
          <Icon :name="syncing ? 'svg-spinners:ring-resize' : 'solar:refresh-linear'" />{{ syncing ? '推薦中' : '依 DB 取得推薦' }}
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
      目前顯示 DB 候選、近 7 日餐食紀錄與個人目標產生的推薦結果
    </p>

    <div class="food-type-tabs" role="tablist">
      <button type="button" :class="{ active: foodType === 'meat' }" @click="foodType = 'meat'">葷食</button>
      <button type="button" :class="{ active: foodType === 'veg' }" @click="foodType = 'veg'">素食</button>
    </div>

    <section class="vendor-card">
      <div class="vendor-card__head"><div><span>今日供餐資料</span><h2>{{ vendorName }}</h2><p>菜單內容來自 `eip_menu_items`；沒有資料時不顯示預設餐點。</p></div><strong>{{ foodType === 'veg' ? '素食' : '葷食／未分類' }}</strong></div>
      <dl><div><dt>資料日期</dt><dd>{{ serviceDate }}</dd></div><div><dt>DB 菜單筆數</dt><dd>{{ menuData?.items.length ?? 0 }} 筆</dd></div><div><dt>最後匯入</dt><dd>{{ lastImportedAt }}</dd></div></dl>
    </section>

    <SectionHeading title="本日菜單" :description="menuDescription" />
    <div v-if="displayedMenus.length" class="menu-grid">
      <MenuCard v-for="item in displayedMenus" :key="item.id" :item="item" :selected="selected?.id === item.id" @select="choose(item)" />
    </div>
    <p v-else class="empty-note">DB 中沒有符合日期與葷／素分類的候選。請先由公司菜單整合流程寫入 `eip_menu_items`，或確認 TFDA／自訂食物資料可供葷食推薦使用。</p>
    <p class="eip-note"><Icon name="solar:info-circle-linear" /> 一食之選會把確認選擇寫入餐食紀錄；EIP 正式點餐仍需依公司流程完成。</p>
    <MealConfirmDialog :open="confirmOpen" :item="selected" :saving="savingSelection" @close="confirmOpen = false" @confirm="confirm" />
  </div>
</template>
