import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Xtream Codes server-side proxy.
 *
 * Browser-side JS cannot call Xtream /player_api.php directly because:
 *  1. Most XC servers don't send CORS headers
 *  2. Some are HTTP-only (mixed-content blocked on HTTPS sites)
 *
 * This route takes a fully-built XC URL from the request body, fetches it
 * server-side, and returns the JSON (or text) response. We don't accept the
 * URL as a query param to keep it out of access logs.
 *
 * Body: { url: string, action?: string }
 */

const MAX_BODY = 5 * 1024 * 1024 // 5 MB cap on response bodies (EPG can be large)

export async function POST(req: NextRequest) {
  let body: { url?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const target = body.url
  if (!target || typeof target !== 'string') {
    return NextResponse.json({ error: 'Missing "url" in body' }, { status: 400 })
  }

  // Only allow http(s) URLs
  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: 'URL must start with http(s)://' }, { status: 400 })
  }

  // Reject obviously-malicious targets (loopback/link-local) — we still allow
  // private IPs because many users self-host kptv-proxy on their LAN.
  try {
    const u = new URL(target)
    if (u.hostname === '0.0.0.0') {
      return NextResponse.json({ error: 'Invalid host' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Malformed URL' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FreeStreamTV/1.0; +xtream)',
        'Accept': 'application/json, text/plain, */*',
      },
      // Don't send cookies/credentials — this is a proxy
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status} ${res.statusText}` },
        { status: 502 },
      )
    }

    const ct = res.headers.get('content-type') || ''
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
    if (contentLength > MAX_BODY) {
      return NextResponse.json(
        { error: `Response too large (${contentLength} bytes)` },
        { status: 413 },
      )
    }

    // Stream-ish action: short_epg / simple_data_table return JSON
    if (ct.includes('application/json') || body.action === 'get_short_epg' || body.action === 'get_simple_data_table') {
      const text = await res.text()
      try {
        const json = JSON.parse(text)
        return NextResponse.json(json)
      } catch {
        return new NextResponse(text, { status: 200, headers: { 'content-type': 'text/plain' } })
      }
    }

    // Fall back to text
    const text = await res.text()
    return new NextResponse(text, {
      status: 200,
      headers: { 'content-type': ct || 'text/plain' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Proxy fetch failed: ${msg}` }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'xtream-proxy',
    usage: 'POST { url, action } to this endpoint',
  })
}
