import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Twitch stream proxy — extracts the HLS URL from a Twitch channel
 * using the Twitch GQL API (public Client-ID) + usher API, then returns
 * it so our HLS.js player can play it directly.
 *
 * This bypasses Twitch's iframe parent-domain restriction entirely.
 *
 * URL format:
 *   /api/twitch?channel=espn
 *   /api/twitch?channel=espn&quality=720p60
 *
 * Returns: JSON { ok, channel, quality, url } where url is the HLS playlist
 * URL our player can load, OR an error JSON if the channel is offline.
 *
 * Quality options: source, 1080p60, 720p60, 720p, 480p, 160p
 *
 * How it works:
 *   1. Call Twitch GQL API with the public web Client-ID to get a
 *      PlaybackAccessToken (value + signature) for the channel.
 *   2. Call the usher API with the token to get the master M3U8 playlist.
 *   3. Parse the master playlist and pick the requested quality variant.
 *   4. Return that variant's URL — the client loads it in HLS.js.
 */

const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko' // Public web Client-ID
const twitchCache = new Map<string, { url: string; expires: number }>()
const CACHE_TTL = 60 * 1000 // 60s — Twitch tokens expire, streams change

type AccessToken = { value: string; signature: string }

/** Fetch a PlaybackAccessToken for a Twitch channel via the GQL API. */
async function getAccessToken(channel: string): Promise<AccessToken | null> {
  // Simplified query — only requests streamPlaybackAccessToken (no unused vars)
  const body = [{
    operationName: 'PlaybackAccessToken',
    query: `query PlaybackAccessToken($login: String!, $playerType: String!) {
  streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) {
    value
    signature
    __typename
  }
}`,
    variables: {
      login: channel,
      playerType: 'site',
    },
  }]

  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null
    const data = await res.json()
    const token = data?.[0]?.data?.streamPlaybackAccessToken
    if (token?.value && token?.signature) {
      return { value: token.value, signature: token.signature }
    }
    return null
  } catch {
    return null
  }
}

/** Pick a quality variant from a Twitch master M3U8 playlist. */
function pickQuality(masterM3u8: string, quality: string): string | null {
  const lines = masterM3u8.split('\n')
  const variants: { url: string; bandwidth: number; resolution: string; fps: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const next = lines[i + 1]?.trim()
      if (!next || next.startsWith('#')) continue

      const bwMatch = line.match(/BANDWIDTH=(\d+)/)
      const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/)
      const fpsMatch = line.match(/FRAME-RATE=([\d.]+)/)

      variants.push({
        url: next,
        bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : 0,
        resolution: resMatch ? `${resMatch[2]}p` : 'unknown',
        fps: fpsMatch ? parseFloat(fpsMatch[1]) : 30,
      })
    }
  }

  if (variants.length === 0) return null
  variants.sort((a, b) => b.bandwidth - a.bandwidth)

  const q = quality.toLowerCase()
  if (q === 'source' || q === 'best' || q === 'auto') return variants[0].url
  if (q === '1080p60') return variants.find(v => v.resolution === '1080p' && v.fps >= 50)?.url || variants[0].url
  if (q === '720p60') return variants.find(v => v.resolution === '720p' && v.fps >= 50)?.url || variants.find(v => v.resolution === '720p')?.url || variants[0].url
  if (q === '720p' || q === '720p30') return variants.find(v => v.resolution === '720p')?.url || variants[0].url
  if (q === '480p' || q === '480p30') return variants.find(v => v.resolution === '480p')?.url || variants[variants.length - 1].url
  if (q === '160p' || q === 'audio' || q === 'worst') return variants[variants.length - 1].url
  return variants[0].url
}

/** Resolve a Twitch channel to a playable HLS URL. */
async function resolveTwitchStream(channel: string, quality: string): Promise<{ url: string; master: boolean } | null> {
  const lcChannel = channel.toLowerCase().trim()
  const cacheKey = `${lcChannel}:${quality}`
  const cached = twitchCache.get(cacheKey)
  if (cached && Date.now() < cached.expires) {
    return { url: cached.url, master: false }
  }

  // Step 1: Get the PlaybackAccessToken
  const token = await getAccessToken(lcChannel)
  if (!token) return null

  // Step 2: Call the usher API with the token
  const usherUrl = new URL(`https://usher.ttvnw.net/api/channel/hls/${lcChannel}.m3u8`)
  usherUrl.searchParams.set('player', 'twitchweb')
  usherUrl.searchParams.set('supported_codecs', 'avc1')
  usherUrl.searchParams.set('allow_source', 'true')
  usherUrl.searchParams.set('fast_bread', 'true')
  usherUrl.searchParams.set('p', String(Math.floor(Math.random() * 1000000)))
  usherUrl.searchParams.set('rbxbnd', String(Math.floor(Math.random() * 1000000)))
  usherUrl.searchParams.set('sig', token.signature)
  usherUrl.searchParams.set('token', token.value)

  try {
    const res = await fetch(usherUrl.toString(), {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.apple.mpegurl, */*',
      },
      redirect: 'follow',
    })

    if (res.ok) {
      const m3u8 = await res.text()
      if (m3u8.includes('#EXTM3U')) {
        const variant = pickQuality(m3u8, quality)
        if (variant) {
          twitchCache.set(cacheKey, { url: variant, expires: Date.now() + CACHE_TTL })
          return { url: variant, master: false }
        }
        // Return the master playlist URL itself
        twitchCache.set(cacheKey, { url: usherUrl.toString(), expires: Date.now() + CACHE_TTL })
        return { url: usherUrl.toString(), master: true }
      }
    }
  } catch {}

  return null
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const channel = searchParams.get('channel')
  const quality = searchParams.get('quality') || 'source'

  if (!channel) {
    return NextResponse.json({
      error: 'Missing ?channel= parameter',
      usage: '/api/twitch?channel=espn[&quality=720p60]',
      qualities: ['source', '1080p60', '720p60', '720p', '480p', '160p'],
    }, { status: 400 })
  }

  try {
    const result = await resolveTwitchStream(channel, quality)
    if (result) {
      return NextResponse.json({
        ok: true,
        channel,
        quality,
        url: result.url,
        master: result.master,
      })
    }

    return NextResponse.json({
      ok: false,
      error: `Channel "${channel}" is offline or stream URL could not be resolved.`,
      hint: 'Twitch requires the channel to be LIVE. Try during a broadcast, or use a 24/7 channel.',
      channel,
    }, { status: 404 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({
      ok: false,
      error: `Failed to resolve Twitch stream: ${msg}`,
      channel,
    }, { status: 502 })
  }
}
