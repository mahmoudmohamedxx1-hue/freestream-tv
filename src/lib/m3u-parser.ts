// M3U / M3U8 playlist parser
// Supports both #EXTINF attributes (tvg-* attributes) and plain URL lines

export type Channel = {
  id: string
  name: string
  url: string
  logo?: string
  group?: string
  tvgId?: string
  tvgName?: string
  country?: string
  language?: string
}

export type ParsedPlaylist = {
  channels: Channel[]
  groups: string[]
  totalCount: number
}

/**
 * Parse #EXTINF attribute string into key-value pairs.
 * Example line:
 *   #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="News",Channel Name
 */
function parseAttributes(extinfLine: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  // Match patterns like key="value"
  const regex = /([a-zA-Z0-9-]+)="([^"]*)"/g
  let match
  while ((match = regex.exec(extinfLine)) !== null) {
    attrs[match[1].toLowerCase()] = match[2]
  }
  return attrs
}

/**
 * Extract the channel name from an #EXTINF line.
 * The name comes after the comma.
 */
function extractName(extinfLine: string): string {
  const commaIdx = extinfLine.lastIndexOf(',')
  if (commaIdx === -1) return 'Unknown Channel'
  return extinfLine.slice(commaIdx + 1).trim() || 'Unknown Channel'
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `ch-${idCounter}`
}

/**
 * Parse M3U playlist text into structured Channel objects.
 */
export function parseM3U(content: string): ParsedPlaylist {
  const lines = content.split(/\r?\n/)
  const channels: Channel[] = []
  const groupSet = new Set<string>()

  let pendingAttrs: Record<string, string> = {}
  let pendingName = ''
  let hasPending = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (line.startsWith('#EXTM3U')) {
      // Header, skip
      continue
    }

    if (line.startsWith('#EXTINF')) {
      pendingAttrs = parseAttributes(line)
      pendingName = extractName(line)
      hasPending = true
      continue
    }

    if (line.startsWith('#EXTGRP')) {
      // Group on its own line
      const group = line.slice(7).trim()
      if (group) pendingAttrs['group-title'] = group
      continue
    }

    if (line.startsWith('#')) {
      // Other directives we don't care about
      continue
    }

    // This is a URL line
    if (hasPending || true) {
      const group = pendingAttrs['group-title'] || 'Other'
      groupSet.add(group)

      channels.push({
        id: nextId(),
        name: pendingName || 'Unknown Channel',
        url: line,
        logo: pendingAttrs['tvg-logo'] || undefined,
        group,
        tvgId: pendingAttrs['tvg-id'] || undefined,
        tvgName: pendingAttrs['tvg-name'] || undefined,
        country: pendingAttrs['tvg-country'] || undefined,
        language: pendingAttrs['tvg-language'] || undefined,
      })

      // Reset
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
