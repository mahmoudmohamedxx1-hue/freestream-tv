// Xtream Codes client — server-side proxy lives at /api/xtream
//
// Standard XC API actions:
//   • auth             → validate credentials, return user_info
//   • live_categories  → list of live-TV categories
//   • live_streams     → list of live channels (optionally by category)
//   • vod_categories   → list of VOD (movie) categories
//   • vod_streams      → list of VOD movies
//   • vod_info         → detailed info for one movie
//   • series_categories→ list of series categories
//   • series           → list of series
//   • series_info      → episodes/seasons for one series
//   • short_epg        → short EPG for one live channel
//   • epg              → full XMLTV EPG (large)
//   • m3u              → full M3U playlist (parsed)

export type XtreamCredentials = {
  server: string      // e.g. "http://example.com:8080" (no trailing slash)
  username: string
  password: string
}

export type XtreamCategory = {
  category_id: string
  category_name: string
  parent_id: number
}

export type XtreamStream = {
  num: number
  name: string
  stream_type: 'live' | 'movie' | 'series'
  stream_id: number
  stream_icon?: string
  epg_channel_id?: string
  added?: string
  category_id?: string
  container_extension?: string  // for VOD: mp4, mkv, ...
  direct_source?: string
}

export type XtreamAuthInfo = {
  user_info: {
    username: string
    password: string
    message: string
    auth: number
    status: string
    exp_date: string | null
    is_trial: string
    active_cons: string
    created_at: string
    max_connections: string
    allowed_output_formats: string[]
  }
  server_info: {
    url: string
    port: string
    https_port: string
    server_protocol: string
    rtmp_port: string
    timezone: string
    timestamp_now: number
    time_now: string
  }
}

const STORAGE_KEY = 'freestream.xtream'

/** Demo credentials — point at our built-in mock XC server at /api/xtream-mock.
 *  The mock returns real iptv-org HLS streams so users can test the XC flow
 *  end-to-end without needing a real XC server. */
export const DEMO_XTREAM_CREDS: XtreamCredentials = {
  server: '/api/xtream-mock',
  username: 'test',
  password: 'test',
}

export function loadXtreamCreds(): XtreamCredentials | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.server && parsed.username && parsed.password) return parsed
    return null
  } catch {
    return null
  }
}

export function saveXtreamCreds(creds: XtreamCredentials) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
  } catch {}
}

export function clearXtreamCreds() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

/** Returns true if the given creds are the demo/mock account. */
export function isDemoCreds(creds: XtreamCredentials | null): boolean {
  if (!creds) return false
  return creds.server === DEMO_XTREAM_CREDS.server
}

function buildUrl(creds: XtreamCredentials, action?: string, extra?: Record<string, string | number>): string {
  const base = creds.server.replace(/\/+$/, '')

  // ─── Mock server uses a different URL scheme ────────────────────────────
  // /api/xtream-mock?path=player_api.php&username=X&password=Y&action=Z
  if (base.startsWith('/api/xtream-mock')) {
    const params = new URLSearchParams({
      path: 'player_api.php',
      username: creds.username,
      password: creds.password,
    })
    if (action) params.set('action', action)
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        params.set(k, String(v))
      }
    }
    return `${base}?${params.toString()}`
  }

  // ─── Real XC server ─────────────────────────────────────────────────────
  const u = new URL('/player_api.php', base)
  u.searchParams.set('username', creds.username)
  u.searchParams.set('password', creds.password)
  if (action) u.searchParams.set('action', action)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      u.searchParams.set(k, String(v))
    }
  }
  return u.toString()
}

async function callXtream<T>(
  creds: XtreamCredentials,
  action?: string,
  extra?: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildUrl(creds, action, extra)

  // ─── Mock server is same-origin — fetch directly, no proxy needed ────────
  if (creds.server.startsWith('/api/xtream-mock')) {
    const res = await fetch(url, { signal })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`Mock XC error ${res.status}: ${txt || res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  // ─── Real XC server — use the CORS proxy ────────────────────────────────
  const res = await fetch('/api/xtream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, action }),
    signal,
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Xtream error ${res.status}: ${txt || res.statusText}`)
  }
  return res.json() as Promise<T>
}

// ─── High-level helpers ──────────────────────────────────────────────────────

export async function xtreamAuth(creds: XtreamCredentials): Promise<XtreamAuthInfo> {
  return callXtream<XtreamAuthInfo>(creds)
}

export async function xtreamLiveCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const data = await callXtream<XtreamCategory[]>(creds, 'get_live_categories')
  return Array.isArray(data) ? data : []
}

export async function xtreamLiveStreams(
  creds: XtreamCredentials,
  categoryId?: string,
): Promise<XtreamStream[]> {
  const extra = categoryId ? { category_id: categoryId } : undefined
  const data = await callXtream<XtreamStream[]>(creds, 'get_live_streams', extra)
  return Array.isArray(data) ? data : []
}

export async function xtreamVodCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const data = await callXtream<XtreamCategory[]>(creds, 'get_vod_categories')
  return Array.isArray(data) ? data : []
}

export async function xtreamVodStreams(
  creds: XtreamCredentials,
  categoryId?: string,
): Promise<XtreamStream[]> {
  const extra = categoryId ? { category_id: categoryId } : undefined
  const data = await callXtream<XtreamStream[]>(creds, 'get_vod_streams', extra)
  return Array.isArray(data) ? data : []
}

export async function xtreamSeriesCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const data = await callXtream<XtreamCategory[]>(creds, 'get_series_categories')
  return Array.isArray(data) ? data : []
}

export async function xtreamSeries(
  creds: XtreamCredentials,
  categoryId?: string,
): Promise<XtreamStream[]> {
  const extra = categoryId ? { category_id: categoryId } : undefined
  const data = await callXtream<XtreamStream[]>(creds, 'get_series', extra)
  return Array.isArray(data) ? data : []
}

/** Fetch the full M3U playlist via the XC /get.php endpoint, parsed server-side. */
export async function xtreamM3U(creds: XtreamCredentials): Promise<{
  channels: any[]
  totalCount: number
}> {
  const base = creds.server.replace(/\/+$/, '')

  // ─── Mock server: build URL for /api/xtream-mock?path=get.php ────────────
  if (base.startsWith('/api/xtream-mock')) {
    const params = new URLSearchParams({
      path: 'get.php',
      username: creds.username,
      password: creds.password,
      type: 'm3u_plus',
      output: 'm3u8',
    })
    const res = await fetch(`/api/playlist?url=${encodeURIComponent(`${base}?${params.toString()}`)}&refresh=1`)
    if (!res.ok) throw new Error('Failed to fetch mock XC M3U')
    return res.json()
  }

  // ─── Real XC server ──────────────────────────────────────────────────────
  const u = new URL('/get.php', base)
  u.searchParams.set('username', creds.username)
  u.searchParams.set('password', creds.password)
  u.searchParams.set('type', 'm3u_plus')
  u.searchParams.set('output', 'm3u8')
  const res = await fetch('/api/playlist?url=' + encodeURIComponent(u.toString()))
  if (!res.ok) throw new Error('Failed to fetch XC M3U')
  return res.json()
}

/** Build the live-stream URL for an Xtream stream id. */
export function xtreamLiveUrl(creds: XtreamCredentials, streamId: number | string): string {
  const base = creds.server.replace(/\/+$/, '')
  return `${base}/live/${creds.username}/${creds.password}/${streamId}.m3u8`
}

/** Build the VOD URL for an Xtream movie id + extension. */
export function xtreamVodUrl(creds: XtreamCredentials, streamId: number | string, ext = 'mp4'): string {
  const base = creds.server.replace(/\/+$/, '')
  return `${base}/movie/${creds.username}/${creds.password}/${streamId}.${ext}`
}

/** Build the series-episode URL. */
export function xtreamSeriesUrl(creds: XtreamCredentials, streamId: number | string, ext = 'mp4'): string {
  const base = creds.server.replace(/\/+$/, '')
  return `${base}/series/${creds.username}/${creds.password}/${streamId}.${ext}`
}

/** Build the XMLTV EPG URL for the account. */
export function xtreamEpgUrl(creds: XtreamCredentials): string {
  const base = creds.server.replace(/\/+$/, '')

  // ─── Mock server ─────────────────────────────────────────────────────────
  if (base.startsWith('/api/xtream-mock')) {
    const params = new URLSearchParams({
      path: 'xmltv.php',
      username: creds.username,
      password: creds.password,
    })
    return `${base}?${params.toString()}`
  }

  // ─── Real XC server ──────────────────────────────────────────────────────
  const u = new URL('/xmltv.php', base)
  u.searchParams.set('username', creds.username)
  u.searchParams.set('password', creds.password)
  return u.toString()
}
