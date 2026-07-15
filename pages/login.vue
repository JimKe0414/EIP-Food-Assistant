<script setup lang="ts">
const email = ref('demo@example.com')
const error = ref('')
const { post } = useApi()
definePageMeta({ layout: false })

async function devLogin() {
  error.value = ''
  try {
    await post('/api/auth/dev', { email: email.value })
    await navigateTo('/')
  } catch {
    error.value = '開發登入未啟用，請使用 Workspace 帳號登入。'
  }
}

useSeoMeta({ title: '登入｜一食之選' })
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <AppLogo />
      <h1>登入一食之選</h1>
      <p>使用組織的 Google Workspace 帳號登入；email 僅用來產生匿名 HMAC 識別碼，不會寫入資料庫。</p>
      <a class="button button--primary button--wide" href="/api/auth/google"><Icon name="logos:google-icon" />使用 Google Workspace 登入</a>
      <details>
        <summary>本機開發登入</summary>
        <form @submit.prevent="devLogin"><label>測試 Email<input v-model="email" type="email" required></label><button class="button button--secondary button--wide" type="submit">登入測試帳號</button></form>
      </details>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </section>
  </main>
</template>
