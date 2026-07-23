// Stalker Portal (Ministra) client — MAC-based IPTV portal protocol
//
// Stalker portals use a different auth model than Xtream Codes:
// Instead of username/password, they use a MAC address (00:1A:79:XX:XX:XX)
// to authenticate a "set-top box" (STB) with the portal server.
//
// API flow:
//   1. GET /stalker_portal/server/load.php?action=handshake&mac=MAC
//      → Returns a token (sn) + profile data
//   2. GET /stalker_portal/server/load.php?action=get_epg_info&mac=MAC&token=TOKEN
//      → Returns channels grouped by categories
//   3. Stream URLs come from the channel data (usually HLS or RTSP)
//
// Common Stalker API actions:
//   - handshake         → authenticate, get token
//   - get_epg_info      → get channels + EPG
//   - get_categories    → channel categories
//   - get_channels      → channel list (often in get_epg_info)
//   - get_vod_info      → VOD movies
//   - get_series        → TV series
//   - get_url           → get stream URL for a channel
//
// URL format: http://portal-url/stalker_portal/server/load.php

export type StalkerCredentials = {
  portalUrl: string  // e.g. "http://portal.example.com"
  mac: string         // e.g. "00:1A:79:XX:XX:XX"
  serial?: string     // optional custom serial number
}

export type StalkerChannel = {
  id: string
  name: string
  number?: string
  logo?: string
  category?: string
  url?: string  // stream URL (may need separate get_url call)
  cmd?: string  // alternative URL source
}

export type StalkerCategory = {
  id: string
  title: string
  category?: string
}

export type StalkerHandshake = {
  token: string
  profile?: any
}

const STORAGE_KEY = 'freestream.stalker'

export function loadStalkerCreds(): StalkerCredentials | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.portalUrl && parsed.mac) return parsed
    return null
  } catch {
    return null
  }
}

export function saveStalkerCreds(creds: StalkerCredentials) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
  } catch {}
}

export function clearStalkerCreds() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function buildUrl(creds: StalkerCredentials, action: string, extra?: Record<string, string>): string {
  const base = creds.portalUrl.replace(/\/+$/, '')
  const u = new URL('/stalker_portal/server/load.php', base)
  u.searchParams.set('action', action)
  u.searchParams.set('mac', creds.mac)
  u.searchParams.set('type', 'stb')
  u.searchParams.set('JsHttpRequest', '1-xml')
  if (creds.serial) u.searchParams.set('sn', creds.serial)
  else u.searchParams.set('sn', '0000000000000')
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      u.searchParams.set(k, v)
    }
  }
  return u.toString()
}

/** Call the Stalker portal via our server-side proxy (CORS bypass). */
async function callStalker<T>(
  creds: StalkerCredentials,
  action: string,
  extra?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildUrl(creds, action, extra)
  const res = await fetch('/api/stalker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, action, mac: creds.mac }),
    signal,
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Stalker error ${res.status}: ${txt || res.statusText}`)
  }
  return res.json() as Promise<T>
}

/** Handshake — authenticate and get token. */
export async function stalkerHandshake(creds: StalkerCredentials): Promise<StalkerHandshake> {
  const data = await callStalker<any>(creds, 'handshake')
  // Stalker returns { js: { token: "..." } } or { token: "..." }
  const token = data?.js?.token || data?.token
  if (!token) throw new Error('No token returned from portal')
  return { token, profile: data?.js || data }
}

/** Get all channels from the portal. */
export async function stalkerGetChannels(
  creds: StalkerCredentials,
  token?: string,
): Promise<{ channels: StalkerChannel[]; categories: StalkerCategory[] }> {
  const extra: Record<string, string> = token ? { token } : {}
  const data = await callStalker<any>(creds, 'get_epg_info', extra)

  const channels: StalkerChannel[] = []
  const categories: StalkerCategory[] = []

  // Stalker returns channels in data.js.data or data.data
  const items = data?.js?.data || data?.data || []
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item.ch_id !== undefined || item.id !== undefined) {
        channels.push({
          id: String(item.ch_id ?? item.id ?? ''),
          name: item.name || item.title || 'Unknown',
          number: item.number ? String(item.number) : undefined,
          logo: item.logo || undefined,
          category: item.tv_genre_id ? String(item.tv_genre_id) : undefined,
          url: item.cmd || item.url || undefined,
          cmd: item.cmd || undefined,
        })
      }
    }
  }

  // Get categories if available
  try {
    const catData = await callStalker<any>(creds, 'get_categories', extra)
    const cats = catData?.js?.items || catData?.items || []
    if (Array.isArray(cats)) {
      for (const c of cats) {
        categories.push({
          id: String(c.id ?? c.category_id ?? ''),
          title: c.title || c.name || 'Unknown',
          category: c.category ? String(c.category) : undefined,
        })
      }
    }
  } catch {}

  return { channels, categories }
}

/** Get the stream URL for a specific channel. */
export async function stalkerGetStreamUrl(
  creds: StalkerCredentials,
  channelId: string,
  token?: string,
): Promise<string | null> {
  const extra: Record<string, string> = { ch_id: channelId, ...(token ? { token } : {}) }
  try {
    const data = await callStalker<any>(creds, 'get_url', extra)
    const url = data?.js?.cmd || data?.cmd || data?.js?.url || data?.url
    return url || null
  } catch {
    return null
  }
}
