import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { parseM3U } from '@/lib/m3u-parser'
import { resolvePlaylistUrl, getCategoryById } from '@/lib/playlists'

export const dynamic = 'force-dynamic'

// Simple in-memory cache to avoid refetching huge playlists on every load
type CacheEntry = {
  data: ReturnType<typeof parseM3U>
  fetchedAt: number
  sourceKey: string
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Read playlist content from a URL or a local public/ path.
 * - Paths starting with "/" are resolved against the project's public/ directory.
 * - Other strings are treated as remote URLs and fetched over HTTP.
 */
async function readPlaylistContent(target: string, req?: NextRequest): Promise<string> {
  // Same-origin API route (e.g. /api/xtream-mock?path=get.php)
  // Fetch via HTTP using the request's origin so it works in dev + prod.
  if (target.startsWith('/api/') || target.startsWith('/custom.m3u')) {
    // For /custom.m3u we still fall through to file read below.
    if (target.startsWith('/api/')) {
      const origin = req?.nextUrl?.origin || `http://localhost:${process.env.PORT || 3000}`
      const fullUrl = new URL(target, origin).toString()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      try {
        const response = await fetch(fullUrl, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to fetch ${target}: ${response.status} ${response.statusText}`)
        }
        return await response.text()
      } finally {
        clearTimeout(timeout)
      }
    }
  }
  // Local public file?
  if (target.startsWith('/') && !target.startsWith('//')) {
    const filePath = path.join(process.cwd(), 'public', target)
    const buf = await readFile(filePath)
    return buf.toString('utf-8')
  }
  // Remote URL
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StreamDeck/2.0)',
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`)
    }
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const providerId = searchParams.get('provider')
  const categoryId = searchParams.get('category')
  const playlistId = searchParams.get('playlist') || undefined
  const url = searchParams.get('url')
  // refresh=1 bypasses cache — for auto-updating playlists (GitHub raw URLs)
  const refresh = searchParams.get('refresh') === '1'

  // Determine what to fetch
  let target: string | null = null
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
    // "memory://" URLs are virtual — handled client-side, never fetched here.
    // Return an empty playlist; the client overrides this with customChannels.
    if (resolved.startsWith('memory://')) {
      return NextResponse.json({
        channels: [],
        groups: [],
        totalCount: 0,
        sourceKey: 'memory',
        cached: false,
        fetchedAt: Date.now(),
      })
    }
    target = resolved
    cacheKey = `${providerId}:${categoryId}:${playlistId ?? '_direct'}`
    sourceLabel = `${providerId}/${categoryId}${playlistId ? '/' + playlistId : ''}`
  } else if (url) {
    target = url
    cacheKey = `url:${url}`
    sourceLabel = 'custom'
  } else {
    return NextResponse.json(
      { error: 'Provide ?provider=&category=&playlist= or ?url=' },
      { status: 400 },
    )
  }

  // Check cache (unless refresh=1)
  if (cacheKey && !refresh) {
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

  // For remote URLs with refresh=1, append a cache-busting query param
  // so any HTTP-level caches also get the latest content.
  if (refresh && target && /^https?:\/\//i.test(target)) {
    try {
      const u = new URL(target)
      u.searchParams.set('_t', String(Date.now()))
      target = u.toString()
    } catch {}
  }

  // ─── Special case: Twitch / YouTube embed URLs ──────────────────────────
  // These aren't real M3U files — they're single-channel embed URLs that the
  // client renders as iframes. We return a synthetic "playlist" with every
  // embed channel from the same category so users can switch between them.
  if (/^(twitch:|twitch-vod:|twitch-clip:|youtube:|youtube-live:)/i.test(target)) {
    if (providerId && categoryId) {
      const cat = getCategoryById(providerId, categoryId)
      if (cat?.playlists) {
        const channels = cat.playlists.map((pl, i) => ({
          id: `embed-${i}`,
          name: pl.name,
          displayName: pl.name,
          rawName: pl.name,
          url: pl.url,
          logo: undefined,
          group: cat.name,
          quality: 'EMBED',
          qualityTier: 0,
          isVod: /^youtube:/.test(pl.url),
        }))
        return NextResponse.json({
          channels,
          groups: [cat.name],
          totalCount: channels.length,
          sourceKey: sourceLabel,
          cached: false,
          fetchedAt: Date.now(),
        })
      }
    }
    // Fallback: single channel
    return NextResponse.json({
      channels: [{
        id: 'embed-0',
        name: 'Embed Stream',
        displayName: 'Embed Stream',
        rawName: 'Embed Stream',
        url: target,
        group: 'Embed',
        quality: 'EMBED',
        qualityTier: 0,
      }],
      groups: ['Embed'],
      totalCount: 1,
      sourceKey: sourceLabel,
      cached: false,
      fetchedAt: Date.now(),
    })
  }

  // Read the M3U content (local file or remote URL)
  try {
    const content = await readPlaylistContent(target!, req)
    const parsed = parseM3U(content)

    // If parsing returned 0 channels but the URL is a direct .m3u8 HLS stream,
    // treat it as a single-channel playlist (the URL itself is the stream)
    if (parsed.channels.length === 0 && target && /\.m3u8?(\?|$)/i.test(target)) {
      // Find the playlist name from the provider catalog
      let channelName = 'Live Stream'
      if (providerId && categoryId && playlistId) {
        const cat = getCategoryById(providerId, categoryId)
        const pl = cat?.playlists?.find(p => p.id === playlistId)
        if (pl) channelName = pl.name
      }
      const singleChannel = {
        id: 'direct-0',
        name: channelName,
        displayName: channelName,
        rawName: channelName,
        url: target,
        group: cat?.name || 'Direct Stream',
        quality: 'HLS',
        qualityTier: 20,
        isVod: false,
      }
      const singleParsed = {
        channels: [singleChannel],
        groups: [singleChannel.group],
        totalCount: 1,
      }
      if (cacheKey) {
        cache.set(cacheKey, { data: singleParsed, fetchedAt: Date.now(), sourceKey: sourceLabel })
      }
      return NextResponse.json({
        ...singleParsed,
        sourceKey: sourceLabel,
        cached: false,
        fetchedAt: Date.now(),
      })
    }

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
    // If fetch failed but it's a direct stream URL, return it as a single channel
    if (target && /\.m3u8?(\?|$)/i.test(target)) {
      let channelName = 'Live Stream'
      if (providerId && categoryId && playlistId) {
        const cat = getCategoryById(providerId, categoryId)
        const pl = cat?.playlists?.find(p => p.id === playlistId)
        if (pl) channelName = pl.name
      }
      return NextResponse.json({
        channels: [{
          id: 'direct-0',
          name: channelName,
          displayName: channelName,
          rawName: channelName,
          url: target,
          group: 'Direct Stream',
          quality: 'HLS',
          qualityTier: 20,
          isVod: false,
        }],
        groups: ['Direct Stream'],
        totalCount: 1,
        sourceKey: sourceLabel,
        cached: false,
        fetchedAt: Date.now(),
      })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to load playlist: ${message}` },
      { status: 500 },
    )
  }
}
