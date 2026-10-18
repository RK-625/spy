/**
 * MCP Apps sandbox proxy (source `src/app/mcp-app-sandbox/route.ts`), served as a
 * `data:` document instead of an app route. Both frames have opaque origins:
 * the outer proxy is sandboxed without `allow-same-origin`, and the untrusted app
 * runs in an inner `srcdoc` frame under the resource's CSP. Neither can read the
 * app's cookies, storage or Convex auth token; they reach the host only through
 * postMessage, which the host bridge answers with an explicit tool allowlist.
 * The proxy itself sets no CSP: a srcdoc frame inherits its parent's policy,
 * which would override the app's declared resource domains.
 */

/** Runs inside the outer frame. Keep it self-contained: it is serialized with toString. */
function sandboxProxy() {
  const inner = document.getElementById(
    'mcp-app-inner',
  ) as HTMLIFrameElement | null
  if (!inner || window.self === window.top) return
  const frame = inner

  // Tokens that would let the inner app escape the opaque-origin sandbox.
  const FORBIDDEN = [
    'allow-same-origin',
    'allow-top-navigation',
    'allow-top-navigation-by-user-activation',
    'allow-popups-to-escape-sandbox',
  ]

  function safeSandbox(value: string) {
    return value
      .split(' ')
      .filter(function (token) {
        return token.length > 0 && FORBIDDEN.indexOf(token) === -1
      })
      .join(' ')
  }

  // Host-derived CSP lists app-declared domains only under connect/img/font-src,
  // but MCP Apps (e.g. Excalidraw) import modules and styles from those domains.
  function promoteDeclaredOrigins(csp: string) {
    const directives = csp
      .split(';')
      .map(function (d) {
        return d.trim()
      })
      .filter(function (d) {
        return d.length > 0
      })
    const origins: Array<string> = []
    directives.forEach(function (d) {
      const parts = d.split(/\s+/)
      if (
        parts[0] === 'connect-src' ||
        parts[0] === 'img-src' ||
        parts[0] === 'font-src'
      ) {
        parts.slice(1).forEach(function (value) {
          if (
            /^https:\/\/[^\s'";,]+$/i.test(value) &&
            origins.indexOf(value) === -1
          )
            origins.push(value)
        })
      }
    })
    if (origins.length === 0) return csp
    return directives
      .map(function (d) {
        const name = d.split(/\s+/)[0]
        return name === 'script-src' || name === 'style-src'
          ? d + ' ' + origins.join(' ')
          : d
      })
      .join('; ')
  }

  // The policy goes before any app markup so the app cannot run code ahead of it.
  function withCsp(html: string, csp: unknown) {
    if (typeof csp !== 'string' || csp.length === 0) return html
    const meta =
      '<meta http-equiv="Content-Security-Policy" content="' +
      promoteDeclaredOrigins(csp)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;') +
      '">'
    const doctype = /^\s*<!doctype[^>]*>/i.exec(html)
    return doctype
      ? doctype[0] + meta + html.slice(doctype[0].length)
      : meta + html
  }

  window.addEventListener('message', function (event) {
    const data = event.data
    if (!data || data.jsonrpc !== '2.0') return
    if (event.source === window.parent) {
      if (data.method === 'ui/notifications/sandbox-resource-ready') {
        const params = data.params || {}
        frame.setAttribute(
          'sandbox',
          safeSandbox(
            typeof params.sandbox === 'string'
              ? params.sandbox
              : 'allow-scripts',
          ),
        )
        if (typeof params.allow === 'string')
          frame.setAttribute('allow', params.allow)
        if (typeof params.html === 'string')
          frame.srcdoc = withCsp(params.html, params.csp)
        return
      }
      if (frame.contentWindow) frame.contentWindow.postMessage(data, '*')
      return
    }
    // The opaque-origin parent cannot be named, so its window identity is the check.
    if (event.source === frame.contentWindow)
      window.parent.postMessage(data, '*')
  })

  window.parent.postMessage(
    {
      jsonrpc: '2.0',
      method: 'ui/notifications/sandbox-proxy-ready',
      params: {},
    },
    '*',
  )
}

const SANDBOX_PROXY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MCP App Sandbox</title>
<style>
html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
#mcp-app-inner { display: block; width: 100%; height: 100%; border: 0; background: transparent; }
</style>
</head>
<body>
<iframe id="mcp-app-inner" title="MCP App" sandbox="allow-scripts"></iframe>
<script>(${sandboxProxy.toString()})()</script>
</body>
</html>`

export const MCP_APP_SANDBOX_URL = `data:text/html;charset=utf-8,${encodeURIComponent(SANDBOX_PROXY_HTML)}`
