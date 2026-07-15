<script setup lang="ts">
import { vendors } from '~/data/mock'
import type { FoodType, MenuItem } from '~/types/diet'

const { goal, goalDescription, notify } = useDietApp()
const foodType = ref<FoodType>('meat')
const selected = ref<MenuItem | null>(null)
const confirmOpen = ref(false)
const syncing = ref(false)
const apiMenus = ref<MenuItem[]>([])
const importInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const { post, postForm, waitForJob } = useApi()
const vendor = computed(() => vendors[foodType.value])
const displayedMenus = computed(() => apiMenus.value.length ? apiMenus.value : vendor.value.menus)

function choose(item: MenuItem) {
  selected.value = item
  confirmOpen.value = true
}

function confirm() {
  confirmOpen.value = false
  notify(`${selected.value?.name}已記錄為今日午餐`)
}

async function syncEip() {
  if (!navigator.onLine) { notify('推薦需要網路連線；目前顯示上次結果'); return }
  syncing.value = true
  try {
    const response = await post<{
      statusUrl: string
      candidates: { id: string, name: string, caloriesKcal: number, proteinG: number | null }[]
      warning?: string
    }>('/api/recommend-lunch', { goal: goal.value, serviceDate: new Date().toISOString().slice(0, 10) })
    const result = await waitForJob<{ candidateIds: string[], reasonById: Record<string, string> }>(response.statusUrl, 25_000)
    const byId = new Map(response.candidates.map(item => [item.id, item]))
    apiMenus.value = result.candidateIds.map((id, index) => {
      const item = byId.get(id)!
      return { name: item.name, kcal: `${item.caloriesKcal} kcal`, reason: result.reasonById[id] ?? '符合目前條件', score: Math.max(70, 96 - index * 4), protein: item.proteinG === null ? '資料不足' : `${item.proteinG} g`, vegetable: '請依餐盤確認' }
    })
    notify(response.warning ?? '推薦已依最新候選更新')
  } catch {
    notify('無法取得即時推薦，請先登入或確認已匯入菜單')
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
    const result = await postForm<{ imported: number }>('/api/eip/import', form)
    notify(`已匯入 ${result.imported} 筆個人點餐紀錄`)
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
    <PageHeading title="午餐推薦" description="依健康目標與 EIP 今日菜單推薦適合的品項">
      <div class="heading-actions">
        <button type="button" class="button button--secondary button--small" :disabled="importing" @click="importInput?.click()"><Icon name="solar:upload-linear" />{{ importing ? '匯入中' : '匯入 EIP' }}</button>
        <input ref="importInput" class="visually-hidden" type="file" accept=".csv,.xlsx,.xls" @change="importEip(($event.target as HTMLInputElement).files?.[0])">
        <button type="button" class="button button--primary button--small" :disabled="syncing" @click="syncEip">
          <Icon :name="syncing ? 'svg-spinners:ring-resize' : 'solar:refresh-linear'" />{{ syncing ? '推薦中' : '取得即時推薦' }}
        </button>
      </div>
    </PageHeading>

    <section class="goal-strip">
      <span><Icon name="solar:target-linear" /></span>
      <div><b>今日策略推薦</b><p>{{ goalDescription }}</p></div>
      <strong>{{ goal }}</strong>
      <NuxtLink to="/profile#goal">調整</NuxtLink>
    </section>

    <div class="food-type-tabs" role="tablist">
      <button type="button" :class="{ active: foodType === 'meat' }" @click="foodType = 'meat'">葷食</button>
      <button type="button" :class="{ active: foodType === 'veg' }" @click="foodType = 'veg'">素食</button>
    </div>

    <section class="vendor-card">
      <div class="vendor-card__head"><div><span>今日供餐</span><h2>{{ vendor.name }}</h2><p>{{ vendor.description }}</p></div><strong>{{ vendor.badge }}</strong></div>
      <dl><div><dt>供餐時段</dt><dd>{{ vendor.time }}</dd></div><div><dt>今日特色</dt><dd>{{ vendor.highlight }}</dd></div><div><dt>近期點餐參考</dt><dd>{{ vendor.recent }}</dd></div></dl>
    </section>

    <SectionHeading title="本日菜單" description="依適合分數排序，選擇後仍需確認" />
    <div class="menu-grid">
      <MenuCard v-for="item in displayedMenus" :key="item.name" :item="item" :selected="selected?.name === item.name" @select="choose(item)" />
    </div>
    <p class="eip-note"><Icon name="solar:info-circle-linear" /> 一食之選提供推薦與記錄，請記得 <b>9:30 前</b>進入 <b>EIP 4.0</b> 完成正式點餐。</p>
    <MealConfirmDialog :open="confirmOpen" :item="selected" @close="confirmOpen = false" @confirm="confirm" />
  </div>
</template>
