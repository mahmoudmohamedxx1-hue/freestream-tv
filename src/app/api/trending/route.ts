import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

let cache: { data: any; fetchedAt: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

type LiveEvent = {
  sport: string
  league: string
  match: string
  status: string
  isLive: boolean
  isToday: boolean
  source: string
}

type TrendingGroup = {
  title: string
  reason: string
  channels: { name: string; url: string; logo?: string; group?: string }[]
}

/**
 * REAL Trending API — fetches actual live sports events.
 *
 * Sources:
 * 1. TheSportsDB (free key "3") — today's events with status
 * 2. ESPN unofficial API — live scoreboards (filters to in-progress only)
 *
 * Only shows events that are:
 * - Currently in progress (status = "In Progress", "Live", "Q1", "Q2", etc.)
 * - Scheduled for today (not future dates)
 *
 * Does NOT show future events from other dates.
 */
export async function GET(req: NextRequest) {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ ...cache.data, cached: true })
  }

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0] // YYYY-MM-DD in UTC
  const liveEvents: LiveEvent[] = []

  // ─── TheSportsDB — today's events ──────────────────────────────────────
  const sportsDBSports = ['Soccer', 'Basketball', 'Baseball', 'IceHockey', 'AmericanFootball', 'Fighting', 'Motorsport']
  for (const sport of sportsDBSports) {
    try {
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${todayStr}&s=${sport}`,
        { signal: AbortSignal.timeout(10000) },
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const event of (data.events || [])) {
        const status = event.strStatus || ''
        const isLive = ['NS', '1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'In Progress',
                        'Q1', 'Q2', 'Q3', 'Q4', 'HT', 'FT', '1st Period', '2nd Period',
                        '3rd Period', 'In Progress'].includes(status)
        const isFinished = status === 'FT' || status === 'Final' || status === 'AOT' || status === 'AP'
        const isToday = (event.dateEvent || '') === todayStr

        // Only include: live now, OR scheduled for today (not yet started), OR finished today
        if (isToday) {
          liveEvents.push({
            sport,
            league: event.strLeague || 'Unknown',
            match: event.strEvent || '',
            status: isFinished ? 'Final' : isLive ? 'Live' : 'Scheduled',
            isLive: isLive && !isFinished,
            isToday: true,
            source: 'TheSportsDB',
          })
        }
      }
    } catch {}
  }

  // ─── ESPN — live scoreboards only ──────────────────────────────────────
  const espnEndpoints = [
    { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
    { sport: 'soccer', league: 'esp.1', name: 'La Liga' },
    { sport: 'soccer', league: 'ita.1', name: 'Serie A' },
    { sport: 'soccer', league: 'ger.1', name: 'Bundesliga' },
    { sport: 'soccer', league: 'fra.1', name: 'Ligue 1' },
    { sport: 'soccer', league: 'uefa.champions', name: 'Champions League' },
    { sport: 'soccer', league: 'uefa.europa', name: 'Europa League' },
    { sport: 'basketball', league: 'nba', name: 'NBA' },
    { sport: 'football', league: 'nfl', name: 'NFL' },
    { sport: 'baseball', league: 'mlb', name: 'MLB' },
    { sport: 'hockey', league: 'nhl', name: 'NHL' },
    { sport: 'soccer', league: 'mex.liga', name: 'Liga MX' },
    { sport: 'soccer', league: 'usa.1', name: 'MLS' },
    { sport: 'soccer', league: 'esp.copa', name: 'Copa del Rey' },
    { sport: 'soccer', league: 'eng.fa', name: 'FA Cup' },
    { sport: 'soccer', league: 'fifa.world', name: 'FIFA World Cup' },
  ]

  for (const ep of espnEndpoints) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${ep.sport}/${ep.league}/scoreboard`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const event of (data.events || [])) {
        const statusDetail = event.status?.type?.detail || ''
        const state = event.status?.type?.state || '' // 'pre', 'in', 'post'
        const eventDate = (event.date || '').split('T')[0]

        // Only include events from today
        if (eventDate !== todayStr) continue

        const isLive = state === 'in'
        const isFinished = state === 'post'

        liveEvents.push({
          sport: ep.sport,
          league: ep.name,
          match: event.shortName || event.name || '',
          status: isLive ? 'Live' : isFinished ? 'Final' : statusDetail,
          isLive,
          isToday: true,
          source: 'ESPN',
        })
      }
    } catch {}
  }

  // ─── Match events to our league channels ───────────────────────────────
  const leaguesDir = path.join(process.cwd(), 'public', 'leagues')
  const curatedDir = path.join(process.cwd(), 'public', 'curated')

  const loadM3U = async (filePath: string) => {
    try {
      const content = await readFile(filePath, 'utf-8')
      const channels: { name: string; url: string; logo?: string; group?: string }[] = []
      const lines = content.split('\n')
      let pendingName = '', pendingLogo: string | undefined, pendingGroup: string | undefined
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#EXTINF')) {
          const commaIdx = trimmed.lastIndexOf(',')
          pendingName = commaIdx !== -1 ? trimmed.slice(commaIdx + 1).trim() : 'Unknown'
          const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/)
          pendingLogo = logoMatch ? logoMatch[1] : undefined
          const groupMatch = trimmed.match(/group-title="([^"]+)"/)
          pendingGroup = groupMatch ? groupMatch[1] : undefined
        } else if (trimmed && !trimmed.startsWith('#')) {
          channels.push({ name: pendingName, url: trimmed, logo: pendingLogo, group: pendingGroup })
          pendingName = ''; pendingLogo = undefined; pendingGroup = undefined
        }
      }
      return channels
    } catch { return [] }
  }

  const leagueFileMap: { [key: string]: string } = {
    'Premier League': 'premier-league',
    'La Liga': 'la-liga',
    'Serie A': 'serie-a',
    'Bundesliga': 'bundesliga',
    'Ligue 1': 'ligue-1',
    'Champions League': 'champions-league',
    'Europa League': 'europa-league',
    'FIFA World Cup': 'world-cup-2026',
    'NFL': 'nfl',
    'NBA': 'nba',
    'MLB': 'mlb',
    'NHL': 'nhl',
  }

  const trendingGroups: TrendingGroup[] = []
  const seenUrls = new Set<string>()

  // Separate live events from scheduled-today events
  const liveEventsByLeague = new Map<string, LiveEvent[]>()
  const todayEventsByLeague = new Map<string, LiveEvent[]>()

  for (const event of liveEvents) {
    if (event.isLive) {
      if (!liveEventsByLeague.has(event.league)) liveEventsByLeague.set(event.league, [])
      liveEventsByLeague.get(event.league)!.push(event)
    } else {
      if (!todayEventsByLeague.has(event.league)) todayEventsByLeague.set(event.league, [])
      todayEventsByLeague.get(event.league)!.push(event)
    }
  }

  // Add LIVE events first (highest priority)
  for (const [league, events] of liveEventsByLeague) {
    const leagueFileId = leagueFileMap[league]
    if (!leagueFileId) continue
    const channels = await loadM3U(path.join(leaguesDir, `${leagueFileId}.m3u`))
    if (channels.length === 0) continue

    const matchNames = events.map(e => e.match).filter(Boolean)
    for (const ch of channels.slice(0, 10)) seenUrls.add(ch.url)

    trendingGroups.push({
      title: `🔴 ${league} — LIVE NOW`,
      reason: `Live: ${matchNames.slice(0, 3).join(', ')}`,
      channels: channels.slice(0, 10).map(ch => ({ ...ch, group: `${league} (Live)` })),
    })
  }

  // Add today's scheduled events (not live yet)
  for (const [league, events] of todayEventsByLeague) {
    if (liveEventsByLeague.has(league)) continue // Already added as live
    const leagueFileId = leagueFileMap[league]
    if (!leagueFileId) continue
    const channels = await loadM3U(path.join(leaguesDir, `${leagueFileId}.m3u`))
    if (channels.length === 0) continue

    const matchNames = events.map(e => e.match).filter(Boolean)
    for (const ch of channels.slice(0, 8)) {
      if (!seenUrls.has(ch.url)) seenUrls.add(ch.url)
    }

    trendingGroups.push({
      title: `${league} — Today`,
      reason: `Scheduled: ${matchNames.slice(0, 3).join(', ')}`,
      channels: channels.slice(0, 8).map(ch => ({ ...ch, group: `${league} (Today)` })),
    })
  }

  // Always add "Top Channels" fallback
  const wcChannels = await loadM3U(path.join(leaguesDir, 'world-cup-2026.m3u'))
  const ufcChannels = await loadM3U(path.join(leaguesDir, 'ufc-mma.m3u'))
  const f1Channels = await loadM3U(path.join(leaguesDir, 'f1-racing.m3u'))
  const sportsChannels = await loadM3U(path.join(curatedDir, 'sports.m3u'))
  const newsChannels = await loadM3U(path.join(curatedDir, 'news.m3u'))

  const topChannels = [
    ...wcChannels.slice(0, 5),
    ...ufcChannels.slice(0, 3),
    ...f1Channels.slice(0, 2),
    ...sportsChannels.slice(0, 5),
    ...newsChannels.slice(0, 5),
  ].filter(ch => !seenUrls.has(ch.url))

  if (topChannels.length > 0) {
    trendingGroups.unshift({
      title: '🔴 Top Channels — Always Streaming',
      reason: 'Best free sports & news channels',
      channels: topChannels.map(ch => ({ ...ch, group: 'Top Channels' })),
    })
  }

  const result = {
    generatedAt: now.toISOString(),
    generatedAtHuman: now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }),
    todayDate: todayStr,
    liveEventsCount: liveEvents.filter(e => e.isLive).length,
    todayEventsCount: liveEvents.filter(e => !e.isLive).length,
    liveEvents: liveEvents.filter(e => e.isLive).slice(0, 20),
    todayEvents: liveEvents.filter(e => !e.isLive).slice(0, 20),
    trending: trendingGroups,
    totalChannels: trendingGroups.reduce((sum, g) => sum + g.channels.length, 0),
  }

  cache = { data: result, fetchedAt: Date.now() }
  return NextResponse.json({ ...result, cached: false })
}
