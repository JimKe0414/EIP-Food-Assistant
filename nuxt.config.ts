const bundledIcons = [
  'logos:google-icon',
  'solar:add-circle-linear',
  'solar:alt-arrow-down-linear',
  'solar:arrow-right-linear',
  'solar:bell-linear',
  'solar:camera-linear',
  'solar:chart-2-linear',
  'solar:check-circle-bold',
  'solar:check-circle-linear',
  'solar:chef-hat-heart-linear',
  'solar:chef-hat-linear',
  'solar:close-circle-linear',
  'solar:cloud-cross-linear',
  'solar:home-2-linear',
  'solar:info-circle-linear',
  'solar:logout-2-linear',
  'solar:magnifer-linear',
  'solar:microphone-2-linear',
  'solar:pen-linear',
  'solar:pen-new-square-linear',
  'solar:refresh-linear',
  'solar:target-linear',
  'solar:upload-linear',
  'solar:user-rounded-linear',
  'solar:verified-check-linear',
  'svg-spinners:ring-resize'
] as const

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: ['@nuxt/icon', '@vite-pwa/nuxt'],
  icon: {
    // Inline SVGs do not need @nuxt/icon's runtime <style> injection, which is
    // intentionally blocked by the nonce-only CSP after client-side navigation.
    mode: 'svg',
    provider: 'none',
    serverBundle: false,
    clientBundle: {
      icons: [...bundledIcons],
      scan: true,
      sizeLimitKb: 128
    }
  },
  components: [
    { path: '~/components', pathPrefix: false }
  ],
  nitro: {
    // Avoid an invalid bare C:\... ESM import for xlsx in Windows dev builds.
    externals: {
      inline: ['xlsx']
    }
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    sessionPassword: process.env.SESSION_PASSWORD ?? 'development-session-password-change-me-32-chars',
    identityHmacSecret: process.env.IDENTITY_HMAC_SECRET ?? 'development-identity-hmac-secret-change-me',
    authMode: process.env.AUTH_MODE ?? 'dev',
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'https://localhost:3000/api/auth/google-callback',
    googleWorkspaceDomain: process.env.GOOGLE_WORKSPACE_DOMAIN ?? '',
    allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true',
    tfdaAutoDownload: process.env.TFDA_AUTO_DOWNLOAD === 'true',
    tfdaNutrientXlsxUrl: process.env.TFDA_NUTRIENT_XLSX_URL ?? 'https://consumer.fda.gov.tw/uc/GetFile.ashx?type=ServerFile&id=4862259227103213368',
    internalWorkerToken: process.env.INTERNAL_WORKER_TOKEN ?? '',
    appTimeZone: process.env.APP_TIME_ZONE ?? 'Asia/Taipei',
    public: {
      authMode: process.env.AUTH_MODE ?? 'dev',
      aiProcessingMode: process.env.AI_EGRESS_MODE === 'cloud-approved' ? 'cloud' : 'local',
      appTimeZone: process.env.APP_TIME_ZONE ?? 'Asia/Taipei',
      e2eBypassAuth: process.env.E2E_BYPASS_AUTH === 'true'
    }
  },
  pwa: {
    registerType: 'prompt',
    injectRegister: 'auto',
    includeAssets: ['icons/*.png'],
    manifest: {
      name: '一食之選',
      short_name: '一食之選',
      description: '智慧飲食記錄與午餐推薦',
      start_url: '/',
      display: 'standalone',
      orientation: 'any',
      theme_color: '#16866a',
      background_color: '#f4f7f6',
      lang: 'zh-Hant',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ],
      shortcuts: [
        { name: '記錄餐食', short_name: '記錄', url: '/record?action=quick', icons: [{ src: '/icons/shortcut-log.png', sizes: '96x96', type: 'image/png' }] },
        { name: '午餐推薦', short_name: '推薦', url: '/recommend', icons: [{ src: '/icons/shortcut-recommend.png', sizes: '96x96', type: 'image/png' }] }
      ]
    },
    workbox: {
      navigateFallback: '/',
      importScripts: ['/sw-background-sync.js'],
      cleanupOutdatedCaches: true,
      clientsClaim: false,
      skipWaiting: false,
      runtimeCaching: [
        {
          urlPattern: /\/api\/meals(?:\?.*)?$/,
          handler: 'NetworkFirst',
          method: 'GET',
          options: { cacheName: 'meals-api', networkTimeoutSeconds: 4, expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 } }
        },
        {
          urlPattern: /\/api\/nutrients(?:\?.*)?$/,
          handler: 'StaleWhileRevalidate',
          method: 'GET',
          options: { cacheName: 'nutrients-api', expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 } }
        },
        {
          urlPattern: /\/icons\//,
          handler: 'CacheFirst',
          options: { cacheName: 'app-icons', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 } }
        }
      ]
    },
    client: { installPrompt: false },
    devOptions: { enabled: true, suppressWarnings: true, type: 'module' }
  },
  routeRules: {
    '/api/**': { headers: { 'cache-control': 'no-store' } }
  },
  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in'
    },
    head: {
      htmlAttrs: { lang: 'zh-Hant' },
      title: '一食之選｜EIP 智慧飲食助手',
      meta: [
        { name: 'description', content: '協助記錄餐食、查看營養趨勢與取得 EIP 午餐推薦。' },
        { name: 'theme-color', content: '#13785f' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ]
    }
  },
  typescript: {
    // Keep production builds deterministic; run `pnpm typecheck` as a separate CI step.
    typeCheck: false,
    strict: true
  }
})
