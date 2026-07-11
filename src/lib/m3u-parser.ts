// M3U / M3U8 playlist parser
// Supports both #EXTINF attributes (tvg-* attributes) and plain URL lines.
// Also extracts country, quality, and status labels (Not 24/7, Geo-blocked) from channel name.

export type Channel = {
  id: string
  name: string
  /** Cleaned display name (no quality suffix, no [Label] tags) */
  displayName: string
  url: string
  logo?: string
  group?: string
  tvgId?: string
  tvgName?: string
  country?: string
  /** ISO country code derived from tvg-id (e.g. "ma" from "2MInternational.ma") */
  countryCode?: string
  language?: string
  /** Video quality: "4K", "1080p", "720p", "576p", "480p", "360p", "SD", or undefined */
  quality?: string
  /** Numeric quality tier for sorting (4K=40, 1080p=30, 720p=20, 576p=15, 480p=10, 360p=5, SD=1) */
  qualityTier?: number
  /** Status flags parsed from name like [Not 24/7], [Geo-blocked] */
  not247?: boolean
  geoBlocked?: boolean
  /** Original raw name (preserves everything) */
  rawName?: string
}

export type ParsedPlaylist = {
  channels: Channel[]
  groups: string[]
  totalCount: number
}

/**
 * Parse #EXTINF attribute string into key-value pairs.
 */
function parseAttributes(extinfLine: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const regex = /([a-zA-Z0-9-]+)="([^"]*)"/g
  let match
  while ((match = regex.exec(extinfLine)) !== null) {
    attrs[match[1].toLowerCase()] = match[2]
  }
  return attrs
}

/** Extract the channel name (after the comma) */
function extractName(extinfLine: string): string {
  const commaIdx = extinfLine.lastIndexOf(',')
  if (commaIdx === -1) return 'Unknown Channel'
  return extinfLine.slice(commaIdx + 1).trim() || 'Unknown Channel'
}

/**
 * Strip decorative prefixes from names like:
 *   "-• ✬● AR | BEIN SPORTS MAX  | AR ●✬•-"  ->  "BEIN SPORTS MAX"
 *   "AR | beIN SPORTS MAX 1 FHD"              ->  "beIN SPORTS MAX 1 FHD"
 */
function cleanName(rawName: string): string {
  let n = rawName.trim()
  // Strip leading "-• ✬● ... | " patterns (common in ktkooot1 m3u files)
  n = n.replace(/^[-•✬●★◆►▷\s]*\|?\s*[A-Za-z]{2}\s*\|\s*/, '')
  // Strip trailing " | AR ●✬•-" patterns
  n = n.replace(/\s*\|\s*[A-Za-z]{2}\s*[-•✬●★◆◄◁\s]*$/, '')
    .replace(/\s+\|$/, '')
    .trim()
  // Collapse multi-spaces
  n = n.replace(/\s{2,}/g, ' ').trim()
  return n || rawName
}

/** Match quality from name (e.g. "1080p", "720p", "4K", "FHD", "HD", "SD") */
function extractQuality(rawName: string): { quality?: string; tier?: number } {
  // Look for explicit pixel quality first
  const m = rawName.match(/\b(4320p|2160p|1440p|1080p|720p|576p|480p|360p|240p)\b/i)
  if (m) {
    const q = m[1].toLowerCase()
    let tier = 0
    if (q === '2160p' || q === '4320p') tier = 40
    else if (q === '1440p') tier = 35
    else if (q === '1080p') tier = 30
    else if (q === '720p') tier = 20
    else if (q === '576p') tier = 15
    else if (q === '480p') tier = 10
    else if (q === '360p') tier = 5
    else if (q === '240p') tier = 3
    if (q === '2160p') return { quality: '4K', tier: 40 }
    if (q === '4320p') return { quality: '8K', tier: 45 }
    return { quality: q, tier }
  }
  // Look for "4K" keyword
  if (/\b4k\b/i.test(rawName)) return { quality: '4K', tier: 40 }
  if (/\b8k\b/i.test(rawName)) return { quality: '8K', tier: 45 }
  // FHD / HD / SD keywords
  if (/\bfhd\b/i.test(rawName)) return { quality: '1080p', tier: 30 }
  if (/\buhd\b/i.test(rawName)) return { quality: '4K', tier: 40 }
  if (/\bhd\b/i.test(rawName)) return { quality: '720p+', tier: 20 }
  if (/\bsd\b/i.test(rawName)) return { quality: 'SD', tier: 1 }
  return {}
}

/** Extract status flags like [Not 24/7], [Geo-blocked] */
function extractFlags(rawName: string): { not247: boolean; geoBlocked: boolean } {
  return {
    not247: /\[not\s*24\/7\]/i.test(rawName) || /\(not\s*24\/7\)/i.test(rawName),
    geoBlocked: /\[geo-?blocked\]/i.test(rawName) || /\(geo-?blocked\)/i.test(rawName),
  }
}

/**
 * Strip quality suffix and [Label] tags from display name.
 * "beIN SPORTS MAX 1 FHD [Not 24/7]" -> "beIN SPORTS MAX 1"
 */
function makeDisplayName(rawName: string): string {
  let n = cleanName(rawName)
  // Remove [Label] tags
  n = n.replace(/\s*\[[^\]]+\]\s*/g, ' ').trim()
  // Remove (Label) tags
  n = n.replace(/\s*\([^)]*(?:not\s*24\/7|geo-?blocked|offline)[^)]*\)\s*/gi, ' ').trim()
  // Remove trailing quality tokens
  n = n.replace(/\s+(FHD|UHD|HD|SD|4K|8K)\b.*$/i, '').trim()
  n = n.replace(/\s+\d{3,4}p\b.*$/i, '').trim()
  return n || rawName
}

/** ISO country code from tvg-id (e.g. "2MInternational.ma" -> "ma") */
function extractCountryCode(tvgId?: string): string | undefined {
  if (!tvgId) return undefined
  const m = tvgId.match(/\.([a-z]{2})$/i)
  return m ? m[1].toLowerCase() : undefined
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `ch-${idCounter}`
}

/**
 * Some M3U files on GitHub are accidentally saved as RTF (Rich Text Format),
 * e.g. Sakatv2025/iptv-playlist/Bein_Sport.m3u was saved by TextEdit on macOS
 * which wrapped it in RTF. This function detects and strips the RTF wrapper,
 * extracting the underlying M3U text.
 *
 * RTF line breaks are encoded as `\` at the end of a line. RTF control words
 * start with `\` (e.g. `\par`, `\f0`, `\cf0`). The actual text content follows
 * the `\cf0 ` marker and ends with `}`.
 */
function stripRtfWrapper(content: string): string {
  // Quick check: not RTF
  if (!content.includes('{\\rtf')) return content

  // Split into lines and extract M3U content
  const lines = content.split(/\r?\n/)
  const out: string[] = []
  let inText = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Detect start of actual text content (after \cf0 marker)
    if (!inText) {
      if (line.includes('\\cf0')) {
        // Extract everything after \cf0 on this line
        const idx = line.indexOf('\\cf0')
        line = line.slice(idx + 4).replace(/^\s+/, '')
        inText = true
        // Fall through to process this line
      } else {
        continue
      }
    }

    // Strip trailing backslash (RTF line break)
    if (line.endsWith('\\') && !line.endsWith('\\\\')) {
      line = line.slice(0, -1)
    }

    // Strip trailing `}` (end of RTF document)
    line = line.replace(/\}$/, '')

    // Unescape RTF escape sequences
    line = line.replace(/\\\\/g, '\\')

    if (line.trim()) out.push(line)
  }

  return out.join('\n')
}

export function parseM3U(content: string): ParsedPlaylist {
  // Strip RTF wrapper if present (some .m3u files were saved as RTF by accident)
  content = stripRtfWrapper(content)

  const lines = content.split(/\r?\n/)
  const channels: Channel[] = []
  const groupSet = new Set<string>()

  let pendingAttrs: Record<string, string> = {}
  let pendingName = ''
  let hasPending = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (line.startsWith('#EXTM3U')) continue

    if (line.startsWith('#EXTINF')) {
      pendingAttrs = parseAttributes(line)
      pendingName = extractName(line)
      hasPending = true
      continue
    }

    if (line.startsWith('#EXTGRP')) {
      const group = line.slice(7).trim()
      if (group) pendingAttrs['group-title'] = group
      continue
    }

    if (line.startsWith('#')) continue

    // URL line
    if (hasPending || true) {
      const group = pendingAttrs['group-title'] || 'Other'
      groupSet.add(group)

      const flags = extractFlags(pendingName)
      const q = extractQuality(pendingName)

      channels.push({
        id: nextId(),
        name: pendingName,
        displayName: makeDisplayName(pendingName),
        rawName: pendingName,
        url: line,
        logo: pendingAttrs['tvg-logo'] || undefined,
        group,
        tvgId: pendingAttrs['tvg-id'] || undefined,
        tvgName: pendingAttrs['tvg-name'] || undefined,
        country: pendingAttrs['tvg-country'] || undefined,
        countryCode: extractCountryCode(pendingAttrs['tvg-id']),
        language: pendingAttrs['tvg-language'] || undefined,
        quality: q.quality,
        qualityTier: q.tier,
        not247: flags.not247,
        geoBlocked: flags.geoBlocked,
      })

      pendingAttrs = {}
      pendingName = ''
      hasPending = false
    }
  }

  return {
    channels,
    groups: Array.from(groupSet).sort((a, b) => a.localeCompare(b)),
    totalCount: channels.length,
  }
}
