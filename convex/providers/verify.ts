import type { ProviderId } from '../../shared/providers'

/** Same fixed provider endpoints as the source app. Never accept a client URL. */
export async function verifyKey(
  provider: ProviderId,
  key: string,
): Promise<'valid' | 'invalid' | 'unavailable'> {
  const bearer = { Authorization: `Bearer ${key}` }
  const requests: Record<ProviderId, { url: string; init: RequestInit }> = {
    openai: {
      url: 'https://api.openai.com/v1/models',
      init: { headers: bearer },
    },
    anthropic: {
      url: 'https://api.anthropic.com/v1/models',
      init: {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      },
    },
    deepseek: {
      url: 'https://api.deepseek.com/models',
      init: { headers: bearer },
    },
    meta: { url: 'https://api.meta.ai/v1/models', init: { headers: bearer } },
    google: {
      url: 'https://generativelanguage.googleapis.com/v1beta/models',
      init: { headers: { 'x-goog-api-key': key } },
    },
    exa: {
      url: 'https://api.exa.ai/search',
      init: {
        method: 'POST',
        headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'exa', numResults: 1, type: 'instant' }),
      },
    },
  }
  try {
    const { url, init } = requests[provider]
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    // Do not surface/log provider bodies, which may echo credentials.
    await response.body?.cancel()
    if (response.ok) return 'valid'
    return [400, 401, 403].includes(response.status) ? 'invalid' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}
