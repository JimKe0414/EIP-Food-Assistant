<script setup lang="ts">
const email = ref('demo@local.test')
const error = ref('')
const { post } = useApi()
const route = useRoute()
const config = useRuntimeConfig()
const googleAuthEnabled = computed(() => config.public.authMode === 'google')
const redirectPath = computed(() => {
  const value = String(route.query.redirect ?? '/')
  return value.startsWith('/') && !value.startsWith('//') ? value : '/'
})
const googleLoginUrl = computed(() => `/api/auth/google?redirect=${encodeURIComponent(redirectPath.value)}`)
const authMessage = computed(() => route.query.reason === 'auth' ? '請先登入後再使用餐廳選擇、推薦與餐食記錄功能。' : '')
definePageMeta({ layout: false })

async function devLogin() {
  error.value = ''
  try {
    await post('/api/auth/dev', { email: email.value })
    await navigateTo(redirectPath.value)
  } catch {
    error.value = '本機開發登入失敗，請確認 ALLOW_DEV_AUTH=true。'
  }
}

useSeoMeta({ title: '登入｜一食之選' })
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <AppLogo />
      <h1>登入一食之選</h1>
      <p v-if="authMessage" class="login-notice" role="status">{{ authMessage }}</p>
      <template v-if="googleAuthEnabled">
        <p>使用個人 Google 帳號登入；系統不會儲存完整 Email。</p>
        <a class="button button--primary button--wide" :href="googleLoginUrl"><Icon name="logos:google-icon" />使用 Google 帳號登入</a>
      </template>
      <template v-else>
        <p>目前使用測試登入。測試 Email 只用來辨識測試帳號，不會儲存完整 Email。</p>
        <form @submit.prevent="devLogin"><label>測試 Email<input v-model="email" type="email" required></label><button class="button button--primary button--wide" type="submit">登入測試帳號</button></form>
      </template>
      <details v-if="googleAuthEnabled">
        <summary>本機開發登入</summary>
        <form @submit.prevent="devLogin"><label>測試 Email<input v-model="email" type="email" required></label><button class="button button--secondary button--wide" type="submit">登入測試帳號</button></form>
      </details>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </section>
  </main>
</template>
