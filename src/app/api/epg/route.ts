import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Cache EPG for 30 minutes
let epgCache: { data: any; fetchedAt: number } | null = null
const CACHE_TTL = 30 * 60 * 1000

type EPGChannel = {
  id: string
  name: string
  network?: string
  country?: string
  categories: string[]
  logo?: string
  url?: string
  nowPlaying: {
    title: string
    category: string
    description: string
    progress: number
    startTime: string
    endTime: string
  }
}

function synthesizeProgram(channelName: string, categories: string[], hour: number) {
  const cat = categories[0] || 'general'
  const now = new Date()
  const startHour = Math.floor(hour / 2) * 2
  const startTime = new Date(now)
  startTime.setHours(startHour, 0, 0, 0)
  const endTime = new Date(now)
  endTime.setHours(startHour + 2, 0, 0, 0)
  const progress = Math.min(Math.round(((hour - startHour) * 60 + now.getMinutes()) / 120 * 100), 100)

  let title = '', description = ''
  switch (cat) {
    case 'sports':
      title = hour >= 19 && hour <= 23 ? 'Live Sports — Evening Match' : hour >= 12 && hour <= 17 ? 'Afternoon Sports' : 'Sports News & Highlights'
      description = 'Catch all the action live with expert commentary and analysis.'
      break
    case 'news':
      title = hour >= 6 && hour <= 9 ? 'Morning News' : hour >= 18 && hour <= 22 ? 'Evening News' : 'News Update'
      description = 'Breaking news, weather, and top stories from around the world.'
      break
    case 'movies':
      const titles = ['Action Movie Marathon', 'Classic Cinema', 'Blockbuster Premier', 'Movie of the Week', 'Late Night Movie', 'Family Movie']
      title = titles[Math.floor(hour / 4) % titles.length]
      description = 'Sit back and enjoy a great movie presentation.'
      break
    case 'music':
      title = hour >= 22 ? 'Late Night Music' : hour >= 16 ? 'Afternoon Hits' : 'Music Showcase'
      description = 'The best music videos and live performances.'
      break
    case 'kids':
      title = hour >= 6 && hour <= 12 ? 'Morning Cartoons' : hour >= 14 && hour <= 18 ? 'Afternoon Kids' : 'Kids Night'
      description = 'Fun and educational programming for children.'
      break
    case 'entertainment':
      title = hour >= 20 ? 'Prime Time Show' : 'Daytime Entertainment'
      description = 'Your favorite shows and entertainment programming.'
      break
    case 'documentary':
      title = ['Nature Documentary', 'Science & Tech', 'History Channel', 'Wildlife', 'Space Exploration'][Math.floor(hour / 3) % 5]
      description = 'Fascinating documentaries and educational content.'
      break
    case 'religious':
      title = 'Spiritual Programming'
      description = 'Inspirational and religious content.'
      break
    default:
      title = `${channelName} — Programming`
      description = 'General entertainment and programming.'
  }

  return { title, category: cat, description, progress, startTime: startTime.toISOString(), endTime: endTime.toISOString() }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const category = searchParams.get('category')

  if (epgCache && Date.now() - epgCache.fetchedAt < CACHE_TTL) {
    let data = epgCache.data
    if (category) {
      data = { ...data, channels: data.channels.filter((ch: EPGChannel) => ch.categories.includes(category)) }
    }
    return NextResponse.json({ ...data, channels: data.channels.slice(0, limit), cached: true })
  }

  try {
    const channelsRes = await fetch('https://iptv-org.github.io/api/channels.json', {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeStreamTV/1.0)' },
    })
    if (!channelsRes.ok) throw new Error(`HTTP ${channelsRes.status}`)
    const allChannels: any[] = await channelsRes.json()

    const streamsRes = await fetch('https://iptv-org.github.io/api/streams.json', {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeStreamTV/1.0)' },
    })
    const streams: any[] = streamsRes.ok ? await streamsRes.json() : []

    const streamMap = new Map<string, { logo?: string; url?: string }>()
    for (const s of streams) {
      if (s.channel) streamMap.set(s.channel, { logo: s.logo, url: s.url })
    }

    const freeNetworks = [
      'Pluto TV', 'Samsung TV Plus', 'LG Channels', 'LG Electronics',
      'Tubi', 'Roku', 'Plex', 'Xumo', 'Vizio', 'Rakuten',
      'Local Now', 'Stirr', 'Red Bull', 'BBC', 'ITV', 'Channel 4',
      'CBC', 'Sky News', 'Al Jazeera', 'Deutsche Welle',
      'France 24', 'CGTN', 'NHK World', 'Arirang', 'beIN Sports',
      'FIFA', 'NFL', 'NBA', 'MLB', 'NHL',
    ]

    const now = new Date()
    const hour = now.getHours()

    const epgChannels: EPGChannel[] = allChannels
      .filter(ch => {
        if (ch.is_nsfw || ch.closed) return false
        const network = (ch.network || '').toLowerCase()
        return freeNetworks.some(fn => network.includes(fn.toLowerCase()))
      })
      .slice(0, 800)
      .map(ch => {
        const streamInfo = streamMap.get(ch.id) || {}
        const categories = ch.categories || ['general']
        return {
          id: ch.id,
          name: ch.name,
          network: ch.network,
          country: ch.country,
          categories,
          logo: streamInfo.logo,
          url: streamInfo.url,
          nowPlaying: synthesizeProgram(ch.name, categories, hour),
        }
      })
      .filter(ch => ch.url)

    epgChannels.sort((a, b) => {
      const netCompare = (a.network || '').localeCompare(b.network || '')
      if (netCompare !== 0) return netCompare
      return a.name.localeCompare(b.name)
    })

    const result = {
      generatedAt: now.toISOString(),
      generatedAtHuman: now.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }),
      totalChannels: epgChannels.length,
      channels: category ? epgChannels.filter(ch => ch.categories.includes(category)) : epgChannels,
    }

    epgCache = { data: result, fetchedAt: Date.now() }

    return NextResponse.json({
      ...result,
      channels: result.channels.slice(0, limit),
      cached: false,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, channels: [], totalChannels: 0 }, { status: 200 })
  }
}
