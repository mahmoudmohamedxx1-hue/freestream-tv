'use client'

import { useState, useEffect } from 'react'

/**
 * Twitch / YouTube embed player.
 *
 * Used when a channel's URL starts with one of:
 *   • twitch:<channel>           → Twitch live embed
 *   • twitch-vod:<videoId>       → Twitch VOD embed
 *   • twitch-clip:<slug>         → Twitch clip embed
 *   • youtube:<videoId>          → YouTube video embed
 *   • youtube-live:<channelId>   → YouTube live embed (24/7 streams)
 *
 * No backend required — uses the official Twitch & YouTube iframe embeds.
 *
 * TWITCH PARENT PARAMETER:
 * Twitch requires the `parent` query param to match the EXACT hostname of the
 * page hosting the iframe. When served through a preview proxy like
 * `preview-xxx.space-z.ai`, we send MULTIPLE parent params to cover all cases:
 *   • The full current hostname (e.g. preview-xxx.space-z.ai)
 *   • The parent domain (space-z.ai) — in case Twitch treats subdomains leniently
 *   • localhost — for local dev
 * Twitch accepts multiple &parent= params and will use whichever matches.
 */

type EmbedPlayerProps = {
  url: string
  channelName?: string
  poster?: string
}

/** Build the list of parent domains Twitch should accept. */
function getParentDomains(): string[] {
  if (typeof window === 'undefined') return ['localhost']
  const host = window.location.hostname
  const parents = new Set<string>([host, 'localhost'])

  // Add the parent domain (last 2 segments) — e.g. space-z.ai from preview-xxx.space-z.ai
  const parts = host.split('.')
  if (parts.length >= 2) {
    // For preview-xxx.space-z.ai → space-z.ai
    // For foo.bar.example.com → example.com
    if (parts.length >= 3 && parts[parts.length - 2].length <= 3) {
      // TLD like .co.uk — take last 3 segments
      parents.add(parts.slice(-3).join('.'))
    } else {
      parents.add(parts.slice(-2).join('.'))
    }
  }

  // Known preview domains — add space-z.ai explicitly
  if (host.includes('space-z.ai')) {
    parents.add('space-z.ai')
    parents.add('preview-z.ai')
  }

  return Array.from(parents)
}

/** Build the &parent= query string for Twitch URLs. */
function buildParentQuery(): string {
  return getParentDomains()
    .map(p => `parent=${encodeURIComponent(p)}`)
    .join('&')
}

export function EmbedPlayer({ url, channelName, poster }: EmbedPlayerProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when URL changes
  useEffect(() => {
    setLoaded(false)
    setError(null)
  }, [url])

  // Build the iframe src
  let src = ''
  let platform = ''
  let helpText = ''

  const parentQuery = buildParentQuery()

  // ─── Twitch live ──────────────────────────────────────────────────────────
  const twitchLive = url.match(/^twitch:(.+)$/i)
  if (twitchLive) {
    const channel = twitchLive[1].trim()
    src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${parentQuery}&muted=false&autoplay=true`
    platform = 'Twitch'
    helpText = `Channel: ${channel}`
  }

  // ─── Twitch VOD ───────────────────────────────────────────────────────────
  const twitchVod = url.match(/^twitch-vod:(.+)$/i)
  if (twitchVod) {
    const videoId = twitchVod[1].trim()
    src = `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&${parentQuery}&muted=false&autoplay=true`
    platform = 'Twitch VOD'
    helpText = `Video ID: ${videoId}`
  }

  // ─── Twitch clip ──────────────────────────────────────────────────────────
  const twitchClip = url.match(/^twitch-clip:(.+)$/i)
  if (twitchClip) {
    const slug = twitchClip[1].trim()
    src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&${parentQuery}`
    platform = 'Twitch Clip'
    helpText = `Clip: ${slug}`
  }

  // ─── YouTube video ────────────────────────────────────────────────────────
  const ytVideo = url.match(/^youtube:(.+)$/i)
  if (ytVideo) {
    const videoId = ytVideo[1].trim()
    src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`
    platform = 'YouTube'
    helpText = `Video ID: ${videoId}`
  }

  // ─── YouTube live (by channel ID) ─────────────────────────────────────────
  const ytLive = url.match(/^youtube-live:(.+)$/i)
  if (ytLive) {
    const channelId = ytLive[1].trim()
    src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&autoplay=1`
    platform = 'YouTube Live'
    helpText = `Channel ID: ${channelId}`
  }

  if (!src) {
    return (
      <div className="aspect-video w-full rounded-xl bg-card flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">Unsupported embed URL</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-md">{url}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Use twitch:CHANNEL, youtube:VIDEO_ID, or youtube-live:CHANNEL_ID
          </p>
        </div>
      </div>
    )
  }

  // If Twitch and the channel name looks invalid (contains spaces, special chars)
  if (platform.startsWith('Twitch')) {
    const channelName = url.replace(/^twitch[^:]*:/i, '').trim()
    if (!/^[a-zA-Z0-9_]{4,25}$/.test(channelName)) {
      return (
        <div className="aspect-video w-full rounded-xl bg-card flex items-center justify-center text-muted-foreground">
          <div className="text-center px-4">
            <p className="text-sm font-semibold text-amber-500">⚠ Invalid Twitch channel name</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">&quot;{channelName}&quot;</p>
            <p className="text-xs text-muted-foreground mt-2">
              Twitch channel names must be 4-25 characters, letters/numbers/underscores only.
              <br />
              The channel &quot;{channelName}&quot; may not exist or may have been renamed.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-3">
              Try a known-good channel: <code className="font-mono text-primary">twitch:espn</code>,{' '}
              <code className="font-mono text-primary">twitch:nfl</code>,{' '}
              <code className="font-mono text-primary">twitch:nba</code>
            </p>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="relative">
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black relative">
        {/* Loading overlay */}
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-foreground/80">Loading {platform}…</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{helpText}</p>
            </div>
          </div>
        )}

        <iframe
          src={src}
          title={channelName || `${platform} embed`}
          allowFullScreen
          className="w-full h-full"
          frameBorder={0}
          allow="autoplay; fullscreen; picture-in-picture"
          onLoad={() => setLoaded(true)}
          onError={() => setError('Failed to load embed')}
        />
      </div>

      {/* Debug / help bar — shows parents (critical for Twitch) */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-secondary font-mono">{platform}</span>
        <span className="font-mono truncate">{helpText}</span>
        {platform.startsWith('Twitch') && (
          <>
            <span className="font-mono text-muted-foreground/60">parents: {getParentDomains().join(', ')}</span>
            {!loaded && (
              <span className="text-amber-500/80 ml-auto">
                ⚠ If blank after 10s, the channel may be offline or parents not accepted.
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Returns true if the given URL is a Twitch/YouTube embed URL. */
export function isEmbedUrl(url: string): boolean {
  return /^(twitch:|twitch-vod:|twitch-clip:|youtube:|youtube-live:)/i.test(url)
}
