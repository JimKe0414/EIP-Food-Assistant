<script setup lang="ts">
const online = ref(true)
const installEligible = ref(false)
const iosInstall = ref(false)
const { $pwa } = useNuxtApp()
const { data: summary } = await useFetch<{ totalMealCount: number }>('/api/meals/summary', { key: 'meal-summary' })

const shouldInstall = computed(() => installEligible.value && Boolean($pwa?.showInstallPrompt) && !$pwa?.isPWAInstalled)
const shouldShowIosGuide = computed(() => installEligible.value && iosInstall.value && !$pwa?.isPWAInstalled)

onMounted(() => {
  online.value = navigator.onLine
  const firstSeen = Number(localStorage.getItem('food:first-seen') ?? Date.now())
  if (!localStorage.getItem('food:first-seen')) localStorage.setItem('food:first-seen', String(firstSeen))
  const mealCount = summary.value?.totalMealCount ?? 0
  const rejectedUntil = Number(localStorage.getItem('food:install-rejected-until') ?? 0)
  installEligible.value = (Date.now() - firstSeen >= 3 * 86_400_000 || mealCount >= 5) && Date.now() >= rejectedUntil
  iosInstall.value = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})

function updateOnline() { online.value = navigator.onLine }
async function install() { await $pwa?.install() }
function rejectInstall() {
  localStorage.setItem('food:install-rejected-until', String(Date.now() + 30 * 86_400_000))
  installEligible.value = false
  $pwa?.cancelInstall()
}
</script>

<template>
  <div class="pwa-status" aria-live="polite">
    <div v-if="!online" class="pwa-banner offline"><Icon name="solar:cloud-cross-linear" />目前離線，顯示最後同步資料</div>
    <div v-if="$pwa?.needRefresh" class="pwa-banner update">有新版本可用<button type="button" @click="$pwa?.updateServiceWorker(true)">立即更新</button></div>
    <div v-if="shouldInstall" class="pwa-banner install">將一食之選加入主畫面<button type="button" @click="install">安裝</button><button type="button" aria-label="30 天內不再提示" @click="rejectInstall">稍後</button></div>
    <div v-else-if="shouldShowIosGuide" class="pwa-banner install">點選分享，再選「加入主畫面」<button type="button" aria-label="30 天內不再提示" @click="rejectInstall">稍後</button></div>
  </div>
</template>
