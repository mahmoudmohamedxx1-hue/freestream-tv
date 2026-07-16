import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Catch-all route for /api/xtream-mock/[...path]
 *
 * Handles direct XC stream URLs like:
 *   /api/xtream-mock/live/test/test/101.m3u8  → 302 redirect to real HLS
 *   /api/xtream-mock/movie/test/test/1001.mp4 → 302 redirect to real VOD URL
 *
 * This mirrors how a real XC server serves streams — the client requests
 * /live/user/pass/id.m3u8 and gets a 302 to the actual HLS manifest.
 */

// Same mock data as the main route — keep in sync
type MockStream = {
  stream_id: number
  name: string
  direct_url: string
}

const MOCK_STREAMS: MockStream[] = [
  { stream_id: 101, name: 'Al Jazeera English', direct_url: 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8' },
  { stream_id: 102, name: 'DW News', direct_url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8' },
  { stream_id: 103, name: 'France 24 English', direct_url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8' },
  { stream_id: 104, name: 'ABC News Live', direct_url: 'https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8' },
  { stream_id: 201, name: 'NFL Channel', direct_url: 'https://d6f8f5cf.wurl.com/v1/lg_nflchannel_1/lg_us/V00000001/0/CkYXQkNcG05TUQdUAQEAUEFYSwlQT1UUDQQfVEEfSlpfXB5aV1w=/contribution-live/lgwurl/MxWxTko7F1DIRi06/nfldigital1_lg/256k/index.m3u8' },
  { stream_id: 202, name: 'Fubo Sports Network', direct_url: 'https://d3ve4bdckg6wjw.cloudfront.net/channel/fubo_sports/hls/hls.m3u8' },
  { stream_id: 203, name: 'Sports Central', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 301, name: 'Movies Central', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 302, name: 'Classic Movies', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 303, name: 'Action Movies', direct_url: 'https://amg01012-amg01012c1-samsungin-8237.playouts.now.amagi.tv/playlist/amg01012-actionmoviesin-samsungin/playlist.m3u8' },
  { stream_id: 401, name: 'Loud TV', direct_url: 'https://amg01012-amg01012c1-samsungin-8237.playouts.now.amagi.tv/playlist/amg01012-actionmoviesin-samsungin/playlist.m3u8' },
  { stream_id: 402, name: 'City Music TV', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 501, name: 'Kids TV', direct_url: 'https://amg01012-amg01012c1-samsungin-8237.playouts.now.amagi.tv/playlist/amg01012-actionmoviesin-samsungin/playlist.m3u8' },
  { stream_id: 502, name: 'Cartoon Channel', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 601, name: 'Entertainment Hub', direct_url: 'https://3309956455.rsc.cdn77.org/3309956455/index.m3u8' },
  { stream_id: 602, name: 'Reality TV', direct_url: 'https://amg01012-amg01012c1-samsungin-8237.playouts.now.amagi.tv/playlist/amg01012-actionmoviesin-samsungin/playlist.m3u8' },
]

const MOCK_VOD = [
  { stream_id: 1001, name: 'Big Buck Bunny', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
  { stream_id: 1002, name: 'Sintel', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4' },
  { stream_id: 1003, name: 'Tears of Steel', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4' },
  { stream_id: 1004, name: 'Elephant Dream', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
  { stream_id: 1101, name: 'Cosmos Documentary', direct_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params
  const pathStr = segments.join('/')

  // Match live/user/pass/id.m3u8 or live/user/pass/id.ts
  const liveMatch = pathStr.match(/^live\/[^/]+\/[^/]+\/(\d+)\.(m3u8|ts)$/)
  if (liveMatch) {
    const streamId = parseInt(liveMatch[1], 10)
    const stream = MOCK_STREAMS.find(s => s.stream_id === streamId)
    if (stream) {
      return NextResponse.redirect(stream.direct_url, { status: 302 })
    }
    return NextResponse.json({ error: `Stream ${streamId} not found` }, { status: 404 })
  }

  // Match movie/user/pass/id.ext
  const movieMatch = pathStr.match(/^movie\/[^/]+\/[^/]+\/(\d+)\.\w+$/)
  if (movieMatch) {
    const vodId = parseInt(movieMatch[1], 10)
    const vod = MOCK_VOD.find(v => v.stream_id === vodId)
    if (vod) {
      return NextResponse.redirect(vod.direct_url, { status: 302 })
    }
    return NextResponse.json({ error: `VOD ${vodId} not found` }, { status: 404 })
  }

  // Match series/user/pass/id.ext
  const seriesMatch = pathStr.match(/^series\/[^/]+\/[^/]+\/(\d+)\.\w+$/)
  if (seriesMatch) {
    // For demo, redirect series to Big Buck Bunny
    return NextResponse.redirect('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', { status: 302 })
  }

  return NextResponse.json({
    error: `Unknown path: ${pathStr}`,
    hint: 'Valid paths: live/user/pass/id.m3u8, movie/user/pass/id.mp4, series/user/pass/id.mp4',
  }, { status: 404 })
}
