<script setup lang="ts">
const { data: session } = await useFetch<{ authenticated: boolean, emailDomain: string | null }>('/api/auth/session')
</script>

<template>
  <header class="mobile-header">
    <AppLogo />
    <NuxtLink v-if="session?.authenticated" class="avatar" to="/profile" aria-label="查看個人資料">我</NuxtLink>
    <NuxtLink v-else class="mobile-header__login" to="/login">登入</NuxtLink>
  </header>
</template>
