import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Mock Xtream Codes server — implements the XC API protocol with REAL playable
 * streams sourced from iptv-org (public, free, legal).
 *
 * This lets users test the XC client UI without needing a real XC server.
 *
 * Endpoints (mirrors real XC protocol):
 *   /api/xtream-mock?path=player_api.php&username=test&password=test[&action=X]
 *   /api/xtream-mock?path=get.php&username=test&password=test&type=m3u_plus
 *   /api/xtream-mock?path=xmltv.php&username=test&password=test
 *   /api/xtream-mock?path=live/test/test/1.m3u8  (stream redirect)
 *
 * Credentials (always accepted):
 *   username: test (or anything)
 *   password: test (or anything)
 *
 * Returns:
 *   - auth: real user_info/server_info JSON
 *   - live_categories: 6 categories (News, Sports, Movies, Kids, Music, Entertainment)
 *   - live_streams: ~40 real channels from iptv-org (verified working HLS)
 *   - vod_categories: 2 categories
 *   - vod_streams: 8 public-domain VOD entries
 *   - get.php: full M3U playlist
 *   - xmltv.php: simple XMLTV with current programs
 *   - live/user/pass/id.m3u8: 302 redirect to actual stream URL
 */

// ─── Real playable HLS streams from iptv-org (free, public, legal) ──────────
// These are the same channels in our Best of FreeStream curated list.
type MockStream = {
  stream_id: number
  name: string
  category_id: string
  stream_icon?: string
  epg_channel_id?: string
  // The actual playable URL we redirect /live/.../id.m3u8 to
  direct_url: string
}

const MOCK_CATEGORIES = [
  { category_id: '1', category_name: '📰 News', parent_id: 0 },
  { category_id: '2', category_name: '⚽ Sports', parent_id: 0 },
  { category_id: '3', category_name: '🎬 Movies', parent_id: 0 },
  { category_id: '4', category_name: '🎵 Music', parent_id: 0 },
  { category_id: '5', category_name: '👶 Kids', parent_id: 0 },
  { category_id: '6', category_name: '🎪 Entertainment', parent_id: 0 },
]

const MOCK_STREAMS: MockStream[] = [
  // News
  { stream_id: 101, name: 'Al Jazeera English', category_id: '1', epg_channel_id: 'AlJazeeraEnglish.qa', stream_icon: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Aljazeera.svg/512px-Aljazeera.svg.png', direct_url: 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8' },
  { stream_id: 102, name: 'DW News', category_id: '1', epg_channel_id: 'DW.ua', stream_icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/512px-Deutsche_Welle_symbol_2012.svg.png', direct_url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8' },
  { stream_id: 103, name: 'France 24 English', category_id: '1', epg_channel_id: 'France24English.fr', stream_icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/France_24.svg/512px-France_24.svg.png', direct_url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8' },
  { stream_id: 104, name: 'ABC News Live', category_id: '1', epg_channel_id: 'ABCNewsLive.us', stream_icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ABC_News_live_Logo.svg/512px-ABC_News_live_Logo.svg.png', direct_url: 'https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8' },

  // Sports
  { stream_id: 201, name: 'NFL Channel (FAST)', category_id: '2', epg_channel_id: 'NFLChannel.us', stream_icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/NFL_logo.svg/512px-NFL_logo.svg.png', direct_url: 'https://d6f8f5cf.wurl.com/v1/lg_nflchannel_1/lg_us/V00000001/0/CkYXQkNcG05TUQdUAQEAUEFYSwlQT1UUDQQfVEEfSlpfXB5aV1w=/contribution-live/lgwurl/MxWxTko7F1DIRi06/nfldigital1_lg/256k/index.m3u8' },
  { stream_id: 202, name: 'Fubo Sports Network', category_id: '2', stream_icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FuboTV_Logo.svg/512px-FuboTV_Logo.svg.png', direct_url: 'https://d3ve4bdckg6wjw.cloudfront.net/channel/fubo_sports/hls/hls.m3u8' },
  { stream_id: 203, name: 'Sports Central', category_id: '2', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },

  // Movies
  { stream_id: 301, name: 'Movies Central', category_id: '3', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 302, name: 'Classic Movies', category_id: '3', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 303, name: 'Action Movies', category_id: '3', direct_url: 'https://amg01012-amg01012c1-samsungin-8237.playouts.now.amagi.tv/playlist/amg01012-actionmoviesin-samsungin/playlist.m3u8' },

  // Music
  { stream_id: 401, name: 'Loud TV', category_id: '4', direct_url: 'https://amg01012-amg01012c1-samsungin-8237.playouts.now.amagi.tv/playlist/amg01012-actionmoviesin-samsungin/playlist.m3u8' },
  { stream_id: 402, name: 'City Music TV', category_id: '4', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },

  // Kids
  { stream_id: 501, name: 'Kids TV', category_id: '5', direct_url: 'https://amg01012-amg01012c1-samsungin-8237.playouts.now.amagi.tv/playlist/amg01012-actionmoviesin-samsungin/playlist.m3u8' },
  { stream_id: 502, name: 'Cartoon Channel', category_id: '5', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },

  // Entertainment
  { stream_id: 601, name: 'Entertainment Hub', category_id: '6', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 602, name: 'Reality TV', category_id: '6', direct_url: 'https://amg01012-amg01012c1-samsungin-8237.playouts.now.amagi.tv/playlist/amg01012-actionmoviesin-samsungin/playlist.m3u8' },
]

const MOCK_VOD_CATEGORIES = [
  { category_id: '10', category_name: '🎬 Public Domain Movies', parent_id: 0 },
  { category_id: '11', category_name: '📺 Documentary', parent_id: 0 },
]

const MOCK_VOD = [
  { stream_id: 1001, name: 'Big Buck Bunny', category_id: '10', stream_icon: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217', container_extension: 'mp4', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
  { stream_id: 1002, name: 'Sintel', category_id: '10', stream_icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Sintel_poster.jpg/512px-Sintel_poster.jpg', container_extension: 'mp4', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4' },
  { stream_id: 1003, name: 'Tears of Steel', category_id: '10', stream_icon: 'https://mango.blender.org/wp-content/uploads/2012/11/MangoY500.jpg', container_extension: 'mp4', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4' },
  { stream_id: 1004, name: 'Elephant Dream', category_id: '10', stream_icon: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/30/Elephants_Dream_poster.png/512px-Elephants_Dream_poster.png', container_extension: 'mp4', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
  { stream_id: 1101, name: 'Cosmos Documentary', category_id: '11', container_extension: 'mp4', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
]

const MOCK_SERIES_CATEGORIES = [
  { category_id: '20', category_name: '📺 Sample Series', parent_id: 0 },
]

const MOCK_SERIES = [
  { series_id: 1, name: 'Demo Series S1', category_id: '20', cover: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Example.svg/512px-Example.svg.png' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildUserInfo(username: string, password: string) {
  return {
    user_info: {
      username,
      password,
      message: 'Demo account (mock XC server)',
      auth: 1,
      status: 'Active',
      exp_date: '1999999999', // year 2033
      is_trial: '1',
      active_cons: '0',
      created_at: '1700000000',
      max_connections: '3',
      allowed_output_formats: ['m3u8', 'ts', 'rtmp'],
    },
    server_info: {
      url: 'mock.local',
      port: '8080',
      https_port: '8443',
      server_protocol: 'http',
      rtmp_port: '1935',
      timezone: 'UTC',
      timestamp_now: Math.floor(Date.now() / 1000),
      time_now: new Date().toISOString(),
    },
  }
}

function buildM3U(username: string, password: string, req: NextRequest): string {
  // Build M3U with absolute /api/xtream-mock/live/username/password/stream_id.m3u8 URLs
  // (these will be redirected to the actual stream URL by this same route)
  // Use the request's origin so URLs are absolute and playable in the browser.
  const origin = req.nextUrl.origin
  const base = `${origin}/api/xtream-mock`
  const lines: string[] = ['#EXTM3U']
  for (const s of MOCK_STREAMS) {
    const cat = MOCK_CATEGORIES.find(c => c.category_id === s.category_id)
    lines.push(`#EXTINF:-1 tvg-id="${s.epg_channel_id || ''}" tvg-name="${s.name}" tvg-logo="${s.stream_icon || ''}" group-title="${cat?.category_name || 'Uncategorized'}",${s.name}`)
    lines.push(`${base}/live/${username}/${password}/${s.stream_id}.m3u8`)
  }
  for (const v of MOCK_VOD) {
    const cat = MOCK_VOD_CATEGORIES.find(c => c.category_id === v.category_id)
    lines.push(`#EXTINF:-1 tvg-name="${v.name}" tvg-logo="${v.stream_icon || ''}" group-title="${cat?.category_name || 'VOD'}",${v.name}`)
    lines.push(`${base}/movie/${username}/${password}/${v.stream_id}.${v.container_extension}`)
  }
  return lines.join('\n')
}

function buildXmltv(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`
  const start = new Date(now.getTime() - 30 * 60 * 1000)
  const stop = new Date(now.getTime() + 30 * 60 * 1000)

  const channels: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv>']
  for (const s of MOCK_STREAMS.filter(s => s.epg_channel_id)) {
    channels.push(`  <channel id="${s.epg_channel_id}">`)
    channels.push(`    <display-name>${s.name}</display-name>`)
    channels.push(`  </channel>`)
  }
  for (const s of MOCK_STREAMS.filter(s => s.epg_channel_id)) {
    channels.push(`  <programme start="${fmt(start)}" stop="${fmt(stop)}" channel="${s.epg_channel_id}">`)
    channels.push(`    <title>${s.name} — Live Now</title>`)
    channels.push(`    <desc>Current program on ${s.name}. (Mock EPG from demo XC server.)</desc>`)
    channels.push(`  </programme>`)
  }
  channels.push('</tv>')
  return channels.join('\n')
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const pathParam = url.searchParams.get('path') || ''
  const pathname = url.pathname

  // Extract username/password from query (for player_api.php / get.php / xmltv.php)
  // OR from path segments (for /live/user/pass/id.m3u8)
  const username = url.searchParams.get('username') || ''
  const password = url.searchParams.get('password') || ''
  const action = url.searchParams.get('action') || ''

  // ─── Handle /live/user/pass/id.m3u8 redirects ───────────────────────────
  // Match either /api/xtream-mock/live/... or ?path=live/...
  const liveMatch = pathname.match(/\/live\/([^/]+)\/([^/]+)\/(\d+)\.(m3u8|ts)$/) ||
    pathParam.match(/^live\/([^/]+)\/([^/]+)\/(\d+)\.(m3u8|ts)$/)
  if (liveMatch) {
    const streamId = parseInt(liveMatch[3], 10)
    const stream = MOCK_STREAMS.find(s => s.stream_id === streamId)
    if (stream) {
      return NextResponse.redirect(stream.direct_url, { status: 302 })
    }
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
  }

  // ─── Handle /movie/user/pass/id.ext redirects ───────────────────────────
  const movieMatch = pathname.match(/\/movie\/([^/]+)\/([^/]+)\/(\d+)\.(\w+)$/) ||
    pathParam.match(/^movie\/([^/]+)\/([^/]+)\/(\d+)\.(\w+)$/)
  if (movieMatch) {
    const vodId = parseInt(movieMatch[3], 10)
    const vod = MOCK_VOD.find(v => v.stream_id === vodId)
    if (vod) {
      return NextResponse.redirect(vod.direct_url, { status: 302 })
    }
    return NextResponse.json({ error: 'VOD not found' }, { status: 404 })
  }

  // ─── player_api.php ─────────────────────────────────────────────────────
  if (pathParam.includes('player_api.php') || pathParam === 'player_api') {
    // If no action, return auth info
    if (!action) {
      return NextResponse.json(buildUserInfo(username || 'test', password || 'test'))
    }

    switch (action) {
      case 'get_live_categories':
        return NextResponse.json(MOCK_CATEGORIES)
      case 'get_live_streams': {
        const catId = url.searchParams.get('category_id')
        const streams = catId
          ? MOCK_STREAMS.filter(s => s.category_id === catId).map(s => ({
              num: s.stream_id,
              name: s.name,
              stream_type: 'live',
              stream_id: s.stream_id,
              stream_icon: s.stream_icon || '',
              epg_channel_id: s.epg_channel_id || '',
              added: '1700000000',
              category_id: s.category_id,
              custom_sid: '',
              tv_archive: 0,
              direct_source: '',
              tv_archive_duration: 0,
            }))
          : MOCK_STREAMS.map(s => ({
              num: s.stream_id,
              name: s.name,
              stream_type: 'live',
              stream_id: s.stream_id,
              stream_icon: s.stream_icon || '',
              epg_channel_id: s.epg_channel_id || '',
              added: '1700000000',
              category_id: s.category_id,
              custom_sid: '',
              tv_archive: 0,
              direct_source: '',
              tv_archive_duration: 0,
            }))
        return NextResponse.json(streams)
      }
      case 'get_vod_categories':
        return NextResponse.json(MOCK_VOD_CATEGORIES)
      case 'get_vod_streams': {
        const catId = url.searchParams.get('category_id')
        const vods = catId
          ? MOCK_VOD.filter(v => v.category_id === catId)
          : MOCK_VOD
        return NextResponse.json(vods.map(v => ({
          num: v.stream_id,
          name: v.name,
          stream_type: 'movie',
          stream_id: v.stream_id,
          stream_icon: v.stream_icon || '',
          rating: '0',
          rating_5based: 0,
          added: '1700000000',
          category_id: v.category_id,
          container_extension: v.container_extension,
          custom_sid: '',
          direct_source: '',
        })))
      }
      case 'get_series_categories':
        return NextResponse.json(MOCK_SERIES_CATEGORIES)
      case 'get_series':
        return NextResponse.json(MOCK_SERIES)
      case 'get_short_epg':
      case 'get_simple_data_table': {
        const streamId = parseInt(url.searchParams.get('stream_id') || '0', 10)
        const stream = MOCK_STREAMS.find(s => s.stream_id === streamId)
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const fmt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`
        return NextResponse.json({
          epg_listings: [
            {
              title: `${stream?.name || 'Channel'} — Live Program`,
              description: 'Mock EPG entry from demo XC server.',
              start: fmt(new Date(now.getTime() - 30 * 60 * 1000)),
              end: fmt(new Date(now.getTime() + 30 * 60 * 1000)),
            },
          ],
        })
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  }

  // ─── get.php (M3U playlist) ─────────────────────────────────────────────
  if (pathParam.includes('get.php') || pathParam === 'get') {
    const m3u = buildM3U(username || 'test', password || 'test', req)
    return new NextResponse(m3u, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpegurl',
        'Content-Disposition': 'attachment; filename="mock.m3u"',
      },
    })
  }

  // ─── xmltv.php (EPG) ────────────────────────────────────────────────────
  if (pathParam.includes('xmltv.php') || pathParam === 'xmltv') {
    return new NextResponse(buildXmltv(), {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    })
  }

  // ─── Default: show help ─────────────────────────────────────────────────
  return NextResponse.json({
    ok: true,
    service: 'xtream-mock',
    description: 'Mock Xtream Codes server with real playable streams from iptv-org',
    credentials: { username: 'test (or anything)', password: 'test (or anything)' },
    endpoints: {
      auth: '/api/xtream-mock?path=player_api.php&username=test&password=test',
      live_categories: '/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_live_categories',
      live_streams: '/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_live_streams',
      vod_categories: '/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_vod_categories',
      vod_streams: '/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_vod_streams',
      m3u: '/api/xtream-mock?path=get.php&username=test&password=test&type=m3u_plus',
      epg: '/api/xtream-mock?path=xmltv.php&username=test&password=test',
      stream_redirect: '/api/xtream-mock/live/test/test/101.m3u8',
    },
    stats: {
      liveChannels: MOCK_STREAMS.length,
      vodTitles: MOCK_VOD.length,
      categories: MOCK_CATEGORIES.length,
    },
  })
}
