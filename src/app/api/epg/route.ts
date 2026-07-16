import { NextRequest, NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'

export const dynamic = 'force-dynamic'

// Cache EPG for 1 hour
let epgCache: { data: any; fetchedAt: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

type EPGProgram = {
  channel: string
  title: string
  start: string
  stop: string
  desc?: string
  progress?: number
  isNow?: boolean
  isNext?: boolean
}

type EPGChannel = {
  id: string
  name: string
  programs: EPGProgram[]
}

/**
 * Multi-source EPG API.
 *
 * Sources (merged in order, best-effort):
 * 1. YanG-1989 EPG (gzipped XMLTV) — Chinese channels
 *    URL: https://material.yang-1989.xyz/epg.xml.gz
 *    (Currently intermittent — may return 0 bytes)
 *
 * 2. Synthesized EPG — generates plausible "now playing" entries based on
 *    channel group/name. This ensures the EPG panel always has content even
 *    when no real XMLTV source is available.
 *
 * 3. (Client-side) Xtream Codes XMLTV — fetched via /api/xtream when user
 *    has XC credentials. The XC server's xmltv.php provides real EPG.
 *
 * NOTE: Free, public, reliable XMLTV sources are extremely rare. The
 * iptv-org/epg project is a TOOL for generating EPG, not a hosted service.
 * Most "free EPG" URLs online are either broken, rate-limited, or behind
 * paywalls. This is why we synthesize a fallback.
 */

// ─── Synthesized EPG generator ──────────────────────────────────────────────
// Generates plausible program titles based on channel group/name + time of day.

const SPORTS_PROGRAMS = [
  'Live Match Coverage', 'SportsCenter', 'Match Highlights', 'Pre-Game Show',
  'Post-Game Analysis', 'Live: Premier League', 'Live: NBA Action', 'Live: NFL Game',
  'Live: La Liga', 'Live: Champions League', 'Live: World Cup Qualifier',
  'Sports News', 'Transfer Talk', 'Classic Matches', 'Athletics Coverage',
  'Tennis: ATP Tour', 'Golf: PGA Tour', 'F1 Race Replay', 'Boxing: Title Fight',
  'MMA: Fight Night', 'Cricket: Test Match', 'Rugby: International',
]

const NEWS_PROGRAMS = [
  'World News', 'Breaking News', 'News Bulletin', 'Business Report',
  'Weather Forecast', 'Market Update', 'Top Stories', 'Live Coverage',
  'News at Six', 'Late Edition', 'International Desk', 'Politics Today',
  'Tech News', 'Sports News', 'Health Report', 'Science & Technology',
]

const MOVIE_PROGRAMS = [
  'Feature Presentation', 'Movie Marathon', 'Blockbuster Hits', 'Classic Cinema',
  'Action Movies', 'Comedy Night', 'Drama Special', 'Horror Double Feature',
  'Sci-Fi Showcase', 'Western Classics', 'Foreign Films', 'Independent Cinema',
  'Director\'s Cut', 'Now Showing', 'Late Night Movie', 'Sunday Matinee',
]

const MUSIC_PROGRAMS = [
  'Top 40 Countdown', 'Music Videos', 'Live Sessions', 'Artist Spotlight',
  'Classic Hits', 'New Releases', 'Genre Mix', 'Late Night Beats',
  'Morning Music', 'Chill Vibes', 'Hit Parade', 'Music News',
]

const KIDS_PROGRAMS = [
  'Cartoon Time', 'Kids Club', 'Animated Adventures', 'Educational Fun',
  'Story Time', 'Sing Along', 'Kids Movies', 'Fun & Games',
  'Magic School Bus', 'Nature for Kids', 'Science for Kids', 'Art Time',
]

const ENTERTAINMENT_PROGRAMS = [
  'Talk Show', 'Game Show', 'Reality TV', 'Variety Show',
  'Comedy Special', 'Late Night Talk', 'Celebrity Interview', 'Talent Show',
  'Cooking Show', 'Home & Garden', 'Travel Show', 'Fashion Focus',
]

const DOCUMENTARY_PROGRAMS = [
  'Nature Documentary', 'History Channel', 'Science Documentary', 'Wildlife',
  'Technology Today', 'Space & Universe', 'Ancient Civilizations', 'Modern Marvels',
  'True Crime', 'Medical Mysteries', 'Engineering Giants', 'Planet Earth',
]

const GENERAL_PROGRAMS = [
  'Live Broadcast', 'Current Program', 'Featured Content', 'Prime Time',
  'Morning Show', 'Afternoon Special', 'Evening Programming', 'Late Night',
  'Now Showing', 'Live Stream', 'Channel Programming', 'Scheduled Content',
]

function pickPrograms(group: string, name: string, count: number): string[] {
  const g = (group + ' ' + name).toLowerCase()
  let pool: string[]

  if (/sport|football|soccer|basketball|baseball|hockey|cricket|tennis|golf|boxing|mma|ufc|f1|nfl|nba|mlb|nhl|espn|bein/.test(g)) {
    pool = SPORTS_PROGRAMS
  } else if (/news|cnn|bbc|al jazeera|fox news|msnbc/.test(g)) {
    pool = NEWS_PROGRAMS
  } else if (/movie|cinema|film|action|comedy|drama|horror|scifi|western|classic/.test(g)) {
    pool = MOVIE_PROGRAMS
  } else if (/music|mtv|vh1|country|jazz|classical/.test(g)) {
    pool = MUSIC_PROGRAMS
  } else if (/kid|child|cartoon|disney|nick|baby/.test(g)) {
    pool = KIDS_PROGRAMS
  } else if (/entertain|talk|show|reality|game/.test(g)) {
    pool = ENTERTAINMENT_PROGRAMS
  } else if (/docu|nature|history|science|wildlife|discovery|national geo/.test(g)) {
    pool = DOCUMENTARY_PROGRAMS
  } else {
    pool = GENERAL_PROGRAMS
  }

  // Pick 'count' random programs deterministically (seeded by name so it's stable per channel)
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[(seed + i * 7) % pool.length])
  }
  return result
}

function synthesizeEpgForChannel(channelId: string, channelName: string, group: string): EPGChannel {
  const now = new Date()
  // Generate 4 programs: previous, current, next, next+1
  // Each program is 30-60 minutes long
  const programTitles = pickPrograms(group, channelName, 4)

  // Current program started 15-45 min ago, ends in 15-45 min
  const currentStart = new Date(now.getTime() - (15 + (channelName.length % 30)) * 60 * 1000)
  const currentEnd = new Date(currentStart.getTime() + (30 + (channelName.length % 30)) * 60 * 1000)

  const programs: EPGProgram[] = [
    {
      channel: channelId,
      title: programTitles[1],
      start: formatXmltvTime(currentStart),
      stop: formatXmltvTime(currentEnd),
      desc: `Scheduled programming on ${channelName}. (Synthesized — no real EPG source available for this channel.)`,
      progress: Math.min(Math.round((now.getTime() - currentStart.getTime()) / (currentEnd.getTime() - currentStart.getTime()) * 100), 100),
      isNow: true,
    },
    {
      channel: channelId,
      title: programTitles[2],
      start: formatXmltvTime(currentEnd),
      stop: formatXmltvTime(new Date(currentEnd.getTime() + 60 * 60 * 1000)),
      desc: `Up next on ${channelName}. (Synthesized)`,
      isNext: true,
    },
  ]

  return { id: channelId, name: channelName, programs }
}

function formatXmltvTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`
}

function parseXmltvTime(s: string): Date {
  const m = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
  if (!m) return new Date(0)
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
}

function parseXmltv(xml: string): Map<string, EPGChannel> {
  const channels = new Map<string, EPGChannel>()

  const channelRegex = /<channel\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/g
  let m
  while ((m = channelRegex.exec(xml)) !== null) {
    const id = m[1]
    const body = m[2]
    const nameMatch = body.match(/<display-name[^>]*>([^<]+)<\/display-name>/)
    const name = nameMatch ? nameMatch[1] : id
    channels.set(id, { id, name, programs: [] })
  }

  const progRegex = /<programme\s+channel="([^"]+)"\s+start="([^"]+)"\s+stop="([^"]+)"[^>]*>([\s\S]*?)<\/programme>/g
  let pm
  while ((pm = progRegex.exec(xml)) !== null) {
    const channelId = pm[1]
    const ch = channels.get(channelId)
    if (!ch) continue
    const body = pm[4]
    const titleMatch = body.match(/<title[^>]*>([^<]*)<\/title>/)
    const descMatch = body.match(/<desc[^>]*>([^<]*)<\/desc>/)
    ch.programs.push({
      channel: channelId,
      title: titleMatch ? titleMatch[1] : 'Unknown',
      start: pm[2],
      stop: pm[3],
      desc: descMatch ? descMatch[1] : undefined,
    })
  }

  return channels
}

async function fetchGzippedXmltv(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeStreamTV/1.0)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new Error('Empty response')
  // Check if it's actually gzipped (magic bytes 1f 8b)
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString('utf-8')
  }
  return buf.toString('utf-8')
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '500', 10)
  const channel = searchParams.get('channel')

  // Check cache
  if (epgCache && Date.now() - epgCache.fetchedAt < CACHE_TTL) {
    let data = epgCache.data
    if (channel) {
      const filtered = data.channels.filter((c: EPGChannel) =>
        c.id === channel ||
        c.id.toLowerCase().endsWith('.' + channel.toLowerCase()) ||
        c.name.toLowerCase().includes(channel.toLowerCase()) ||
        channel.toLowerCase().includes(c.name.toLowerCase()),
      )
      return NextResponse.json({
        ...data,
        channels: filtered.slice(0, limit),
        cached: true,
      })
    }
    return NextResponse.json({
      ...data,
      channels: data.channels.slice(0, limit),
      cached: true,
    })
  }

  // ─── Fetch real EPG from YanG-1989 (best-effort) ────────────────────────
  const realEpg = new Map<string, EPGChannel>()
  const sources: string[] = []

  try {
    const yangXml = await fetchGzippedXmltv('https://material.yang-1989.xyz/epg.xml.gz')
    if (yangXml && yangXml.length > 100) {
      const yangData = parseXmltv(yangXml)
      for (const [id, ch] of yangData) {
        realEpg.set(id, { id, name: ch.name, programs: ch.programs })
      }
      sources.push(`YanG-1989 XMLTV (${yangData.size} channels, real)`)
    } else {
      sources.push('YanG-1989 XMLTV: empty response')
    }
  } catch (e) {
    sources.push(`YanG-1989 XMLTV: ${e instanceof Error ? e.message : 'failed'}`)
  }

  // ─── Compute "now playing" + "next" for real EPG channels ───────────────
  const now = new Date()
  const epgChannels: EPGChannel[] = []

  for (const [id, ch] of realEpg) {
    if (ch.programs.length === 0) continue
    const current = ch.programs.find(p => {
      const start = parseXmltvTime(p.start)
      const stop = parseXmltvTime(p.stop)
      return start <= now && now < stop
    })
    const next = ch.programs.find(p => parseXmltvTime(p.start) > now)

    if (current || ch.programs.length > 0) {
      const start = current ? parseXmltvTime(current.start) : null
      const stop = current ? parseXmltvTime(current.stop) : null
      const progress = start && stop
        ? Math.min(Math.round((now.getTime() - start.getTime()) / (stop.getTime() - start.getTime()) * 100), 100)
        : 0

      epgChannels.push({
        id: ch.id,
        name: ch.name,
        programs: [
          ...(current ? [{
            channel: ch.id,
            title: current.title,
            start: current.start,
            stop: current.stop,
            desc: current.desc,
            progress,
            isNow: true,
          }] : []),
          ...(next ? [{
            channel: ch.id,
            title: next.title,
            start: next.start,
            stop: next.stop,
            desc: next.desc,
            isNext: true,
          }] : []),
        ],
      })
    }
  }

  const realCount = epgChannels.length
  const totalPrograms = Array.from(realEpg.values()).reduce((sum, ch) => sum + ch.programs.length, 0)

  const data = {
    source: sources.length > 0 && realCount > 0
      ? `Real EPG: ${sources.join('; ')}`
      : `Synthesized EPG (no real XMLTV source available — ${sources.join('; ')})`,
    generatedAt: now.toISOString(),
    totalChannels: realCount,
    totalPrograms,
    channels: epgChannels,
    sources,
    realCount,
    synthesized: realCount === 0,
  }

  epgCache = { data, fetchedAt: Date.now() }

  let filtered = epgChannels
  if (channel) {
    filtered = epgChannels.filter(c =>
      c.id === channel ||
      c.id.toLowerCase().endsWith('.' + channel.toLowerCase()) ||
      c.name.toLowerCase().includes(channel.toLowerCase()) ||
      channel.toLowerCase().includes(c.name.toLowerCase()),
    )
  }

  return NextResponse.json({
    ...data,
    channels: filtered.slice(0, limit),
    cached: false,
  })
}

// Export synthesizeEpgForChannel for client-side synthesis when no server EPG matches
export { synthesizeEpgForChannel }
