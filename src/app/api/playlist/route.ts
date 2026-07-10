import { NextRequest, NextResponse } from 'next/server'
import { parseM3U } from '@/lib/m3u-parser'
import { resolvePlaylistUrl } from '@/lib/playlists'

export const dynamic = 'force-dynamic'

// Simple in-memory cache to avoid refetching huge playlists on every load
type CacheEntry = {
  data: ReturnType<typeof parseM3U>
  fetchedAt: number
  sourceKey: string
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const providerId = searchParams.get('provider')
  const categoryId = searchParams.get('category')
  const playlistId = searchParams.get('playlist') || undefined
  const url = searchParams.get('url')

  // Determine what to fetch
  let targetUrl: string | null = null
  let cacheKey: string | null = null
  let sourceLabel = 'custom'

  if (providerId && categoryId) {
    const resolved = resolvePlaylistUrl(providerId, categoryId, playlistId)
    if (!resolved) {
      return NextResponse.json(
        { error: 'Unknown provider/category/playlist combination' },
        { status: 404 },
      )
    }
    targetUrl = resolved
    cacheKey = `${providerId}:${categoryId}:${playlistId ?? '_direct'}`
    sourceLabel = `${providerId}/${categoryId}${playlistId ? '/' + playlistId : ''}`
  } else if (url) {
    targetUrl = url
    cacheKey = `url:${url}`
    sourceLabel = 'custom'
  } else {
    return NextResponse.json(
      { error: 'Provide ?provider=&category=&playlist= or ?url=' },
      { status: 400 },
    )
  }

  // Check cache
  if (cacheKey) {
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.data,
        sourceKey: cached.sourceKey,
        cached: true,
        fetchedAt: cached.fetchedAt,
      })
    }
  }

  // Fetch the M3U file
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const response = await fetch(targetUrl!, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StreamDeck/2.0)',
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch playlist: ${response.status} ${response.statusText}` },
        { status: 502 },
      )
    }

    const content = await response.text()
    const parsed = parseM3U(content)

    // Cache it
    if (cacheKey) {
      cache.set(cacheKey, {
        data: parsed,
        fetchedAt: Date.now(),
        sourceKey: sourceLabel,
      })
    }

    return NextResponse.json({
      ...parsed,
      sourceKey: sourceLabel,
      cached: false,
      fetchedAt: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to load playlist: ${message}` },
      { status: 500 },
    )
  }
}
