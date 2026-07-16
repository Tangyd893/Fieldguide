/**
 * Join OpenAI-compatible base URL with an API path without doubling `/v1`.
 *
 * Presets often use `https://api.example.com/v1`; callers append `/v1/chat/completions`.
 */
export function joinLlmUrl(baseUrl: string, apiPath: string): string {
  const base = (baseUrl || '').replace(/\/+$/, '')
  let path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`

  // If base already ends with /v1 and path starts with /v1/, drop one /v1
  if (/\/v1$/i.test(base) && /^\/v1(\/|$)/i.test(path)) {
    path = path.replace(/^\/v1/i, '') || '/'
  }

  return `${base}${path}`
}
