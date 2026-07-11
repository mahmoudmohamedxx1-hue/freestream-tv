import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
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

/**
 * Read playlist content from a URL or a local public/ path.
 * - Paths starting with "/" are resolved against the project's public/ directory.
 * - Other strings are treated as remote URLs and fetched over HTTP.
 */
async function readPlaylistContent(target: string): Promise<string> {
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

  // Read the M3U content (local file or remote URL)
  try {
    const content = await readPlaylistContent(target!)
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
