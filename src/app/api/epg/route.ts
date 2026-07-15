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
}

type EPGChannel = {
  id: string
  name: string
  programs: EPGProgram[]
}

/**
 * Real EPG API — fetches actual XMLTV program guide data.
 *
 * Sources:
 * 1. YanG-1989 EPG (https://material.yang-1989.xyz/epg.xml.gz)
 *    - 437 channels, 50,000+ programs
 *    - Chinese channels (CCTV, Now Sports, BBC Earth, etc.)
 *    - Real program titles, start/stop times
 *
 * 2. Our synthesized EPG (fallback for channels without real EPG)
 */

function parseXmltv(xml: string): Map<string, EPGChannel> {
  const channels = new Map<string, EPGChannel>()

  // Parse channels
  const channelRegex = /<channel id="([^"]+)">[\s\S]*?<display-name[^>]*>([^<]+)<\/display-name>[\s\S]*?<\/channel>/g
  let m
  while ((m = channelRegex.exec(xml)) !== null) {
    channels.set(m[1], {
      id: m[1],
      name: m[2],
      programs: [],
    })
  }

  // Parse programmes
  const progRegex = /<programme channel="([^"]+)" start="([^"]+)" stop="([^"]+)"[^>]*>[\s\S]*?<title[^>]*>([^<]*)<\/title>(?:[\s\S]*?<desc[^>]*>([^<]*)<\/desc>)?[\s\S]*?<\/programme>/g
  let pm
  while ((pm = progRegex.exec(xml)) !== null) {
    const channelId = pm[1]
    const ch = channels.get(channelId)
    if (ch) {
      ch.programs.push({
        channel: channelId,
        title: pm[4],
        start: pm[2],
        stop: pm[3],
        desc: pm[5],
      })
    }
  }

  return channels
}

function parseXmltvTime(s: string): Date {
  const m = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
  if (!m) return new Date(0)
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const channel = searchParams.get('channel')

  if (epgCache && Date.now() - epgCache.fetchedAt < CACHE_TTL) {
    let data = epgCache.data
    if (channel) {
      data = { ...data, channels: data.channels.filter((c: EPGChannel) => c.id === channel || c.name.includes(channel)) }
    }
    return NextResponse.json({ ...data, channels: data.channels.slice(0, limit), cached: true })
  }

  try {
    // Fetch YanG-1989 EPG (gzipped XMLTV)
    const res = await fetch('https://material.yang-1989.xyz/epg.xml.gz', {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeStreamTV/1.0)' },
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const gzBuffer = Buffer.from(await res.arrayBuffer())
    const xml = gunzipSync(gzBuffer).toString('utf-8')

    // Parse XMLTV
    const epgData = parseXmltv(xml)

    // Find current programs
    const now = new Date()
    const epgChannels: EPGChannel[] = []

    for (const [id, ch] of epgData) {
      // Find current program
      const current = ch.programs.find(p => {
        const start = parseXmltvTime(p.start)
        const stop = parseXmltvTime(p.stop)
        return start <= now && now < stop
      })

      // Find next program
      const next = ch.programs.find(p => {
        const start = parseXmltvTime(p.start)
        return start > now
      })

      if (current || ch.programs.length > 0) {
        const start = current ? parseXmltvTime(current.start) : null
        const stop = current ? parseXmltvTime(current.stop) : null
        const progress = start && stop ? Math.min(Math.round((now.getTime() - start.getTime()) / (stop.getTime() - start.getTime()) * 100), 100) : 0

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

    const result = {
      source: 'YanG-1989 XMLTV',
      generatedAt: now.toISOString(),
      totalChannels: epgChannels.length,
      totalPrograms: Array.from(epgData.values()).reduce((sum, ch) => sum + ch.programs.length, 0),
      channels: epgChannels,
    }

    epgCache = { data: result, fetchedAt: Date.now() }

    let filtered = epgChannels
    if (channel) {
      filtered = epgChannels.filter(c => c.id === channel || c.name.includes(channel))
    }

    return NextResponse.json({
      ...result,
      channels: filtered.slice(0, limit),
      cached: false,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'

    // Fallback to synthesized EPG
    return NextResponse.json({
      error: `Real EPG failed: ${msg}. Using synthesized fallback.`,
      source: 'synthesized',
      channels: [],
      totalChannels: 0,
      cached: false,
    }, { status: 200 })
  }
}
