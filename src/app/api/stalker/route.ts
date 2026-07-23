import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Stalker Portal server-side proxy.
 *
 * Stalker portals don't send CORS headers, so browser JS can't call them
 * directly. This route proxies requests server-side.
 *
 * Body: { url: string, action?: string, mac?: string }
 */

export async function POST(req: NextRequest) {
  let body: { url?: string; action?: string; mac?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const target = body.url
  if (!target || typeof target !== 'string') {
    return NextResponse.json({ error: 'Missing "url" in body' }, { status: 400 })
  }
  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: 'URL must start with http(s)://' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    // Stalker portals expect specific headers that mimic a real STB
    const res = await fetch(target, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': `mac=${body.mac || ''}; stb_lang=en; timezone=Europe/London`,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Portal returned ${res.status} ${res.statusText}` },
        { status: 502 },
      )
    }

    const text = await res.text()
    // Try to parse as JSON, fall back to text
    try {
      const json = JSON.parse(text)
      return NextResponse.json(json)
    } catch {
      return new NextResponse(text, {
        status: 200,
        headers: { 'content-type': res.headers.get('content-type') || 'text/plain' },
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Proxy fetch failed: ${msg}` }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
