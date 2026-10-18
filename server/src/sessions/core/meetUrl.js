/**
 * Valida un enlace de Google Meet: https://meet.google.com/abc-defg-hij
 * (minusculas; se ignora la query, p. ej. ?authuser=0). Rechaza otros hosts.
 */
export function isValidMeetUrl(value) {
  if (typeof value !== 'string') return false
  let url
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === 'meet.google.com' &&
    !url.username &&
    !url.password &&
    /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname)
  )
}
