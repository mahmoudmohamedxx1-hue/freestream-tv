import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Cache for 1 hour
let cache: { data: any; fetchedAt: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

/**
 * TV Guide endpoint — returns a curated list of popular free channels
 * with their metadata (network, country, categories, logo).
 *
 * Uses the iptv-org channels.json API which contains channel metadata.
 * Since EPG XML files are no longer hosted, we present a curated guide
 * of popular free-to-air channels organized by category.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '60', 10)
  const category = searchParams.get('category') // sports, news, movies, music, kids, entertainment

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    let data = cache.data
    if (category) {
      data = data.filter((ch: any) => ch.categories?.includes(category))
    }
    return NextResponse.json({ channels: data.slice(0, limit), cached: true, total: data.length })
  }

  try {
    // Fetch channels database
    const response = await fetch('https://iptv-org.github.io/api/channels.json', {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeStreamTV/1.0)' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const allChannels: any[] = await response.json()

    // Curated list of free FAST platforms and free-to-air networks
    const freeNetworks = [
      'Pluto TV', 'Samsung TV Plus', 'Samsung TV', 'LG Channels', 'LG Electronics',
      'Tubi', 'Roku', 'Plex', 'Xumo', 'Vizio', 'Rakuten',
      'Local Now', 'Stirr', 'Red Bull', 'BBC', 'ITV', 'Channel 4',
      'CBC', 'Sky News', 'Al Jazeera', 'DW (Deutsche Welle)', 'Deutsche Welle',
      'France 24', 'CGTN', 'NHK World', 'Arirang', 'beIN Sports',
      'FIFA', 'NFL', 'NBA', 'MLB', 'NHL',
    ]

    // Filter to channels that belong to a known free network
    const scored = allChannels
      .filter(ch => !ch.is_nsfw && !ch.closed)
      .map(ch => {
        let score = 0
        const network = (ch.network || '').toLowerCase()
        const name = (ch.name || '').toLowerCase()

        // Known free networks get high score
        for (const fn of freeNetworks) {
          if (network.includes(fn.toLowerCase()) || name.includes(fn.toLowerCase())) {
            score += 100
            break
          }
        }

        // Categories that are commonly free
        const cats = ch.categories || []
        if (cats.includes('sports')) score += 30
        if (cats.includes('news')) score += 25
        if (cats.includes('movies')) score += 20
        if (cats.includes('music')) score += 15
        if (cats.includes('kids')) score += 15
        if (cats.includes('entertainment')) score += 10

        return { ...ch, _score: score }
      })
      .filter(ch => ch._score >= 100) // Only channels from known free networks
      .sort((a, b) => b._score - a._score)

    // Map to a cleaner format
    // Also fetch streams.json to get logos (channels.json doesn't have logos)
    let logoMap = new Map<string, string>()
    try {
      const streamsRes = await fetch('https://iptv-org.github.io/api/streams.json', {
        signal: AbortSignal.timeout(20000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeStreamTV/1.0)' },
      })
      if (streamsRes.ok) {
        const streams: any[] = await streamsRes.json()
        for (const s of streams) {
          if (s.channel && s.logo) {
            logoMap.set(s.channel, s.logo)
          }
        }
      }
    } catch {}

    const guide = scored.map(ch => ({
      id: ch.id,
      name: ch.name,
      network: ch.network,
      country: ch.country,
      categories: ch.categories,
      logo: logoMap.get(ch.id) || undefined,
      altNames: ch.alt_names,
      launched: ch.launched,
    }))

    cache = { data: guide, fetchedAt: Date.now() }

    let result = guide
    if (category) {
      result = guide.filter((ch: any) => ch.categories?.includes(category))
    }

    return NextResponse.json({
      channels: result.slice(0, limit),
      cached: false,
      total: result.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, channels: [], total: 0 }, { status: 200 })
  }
}
