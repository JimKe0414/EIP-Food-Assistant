<script setup lang="ts">
const email = ref('demo@local.test')
const error = ref('')
const { post } = useApi()
const config = useRuntimeConfig()
const googleAuthEnabled = computed(() => config.public.authMode === 'google')
definePageMeta({ layout: false })

async function devLogin() {
  error.value = ''
  try {
    await post('/api/auth/dev', { email: email.value })
    await navigateTo('/')
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
      <template v-if="googleAuthEnabled">
        <p>使用個人 Google 帳號登入；Email 只會用來產生匿名 HMAC 識別碼，不會寫入資料庫。</p>
        <a class="button button--primary button--wide" href="/api/auth/google"><Icon name="logos:google-icon" />使用 Google 帳號登入</a>
      </template>
      <template v-else>
        <p>目前使用本機開發登入。測試 Email 只會用來產生匿名 HMAC 識別碼。</p>
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
