<script setup lang="ts">
import { navigation } from '~/data/navigation'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const { data: session } = await useFetch<{ authenticated: boolean, emailDomain: string | null }>('/api/auth/session')
const { post } = useApi()
const processingLabel = computed(() => runtimeConfig.public.aiProcessingMode === 'cloud' ? '雲端核准處理' : '地端安全處理')

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

async function logout() {
  await post('/api/auth/logout')
  await navigateTo('/login')
}
</script>

<template>
  <aside class="desktop-sidebar">
    <div>
      <AppLogo />
      <div class="processing-badge"><span /> {{ processingLabel }}</div>
    </div>

    <nav class="desktop-nav" aria-label="主要導覽">
      <NuxtLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        :class="{ active: isActive(item.to) }"
      >
        <Icon :name="item.icon" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div v-if="session?.authenticated" class="account-card">
      <div class="avatar">我</div>
      <div><b>Workspace 使用者</b><span>{{ session.emailDomain }}</span></div>
      <button type="button" aria-label="登出" @click="logout"><Icon name="solar:logout-2-linear" /></button>
    </div>
    <NuxtLink v-else class="button button--soft button--wide" to="/login">登入</NuxtLink>
  </aside>
</template>
