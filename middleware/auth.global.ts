export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const session = await $fetch<{ authenticated: boolean }>('/api/auth/session', { headers })
    if (session.authenticated) return
  } catch {
    // A network failure is not proof that the session is invalid. Let the page load so
    // offline UI can still render; authenticated API calls handle an actual 401 centrally.
    return
  }

  return navigateTo({
    path: '/login',
    query: { reason: 'auth', redirect: to.fullPath }
  })
})
