// Cookies default to Secure (HTTPS-only), matching how the app is meant to run in
// production. Set COOKIE_SECURE=false only for local, non-HTTPS testing (e.g. running
// the production Docker build against plain http://localhost) — browsers silently drop
// Secure cookies over plain HTTP, which breaks CSRF/session entirely.
export function useSecureCookies() {
  if (import.meta.dev) return false
  return process.env.COOKIE_SECURE !== 'false'
}
