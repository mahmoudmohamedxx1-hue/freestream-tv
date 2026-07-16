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
 */

type EmbedPlayerProps = {
  url: string
  channelName?: string
  poster?: string
}

function detectHost(): string {
  if (typeof window === 'undefined') return 'localhost'
  return window.location.hostname
}

export function EmbedPlayer({ url, channelName, poster }: EmbedPlayerProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const host = detectHost()

  // Reset state when URL changes
  useEffect(() => {
    setLoaded(false)
    setError(null)
  }, [url])

  // Build the iframe src
  let src = ''
  let platform = ''
  let helpText = ''

  // ─── Twitch live ──────────────────────────────────────────────────────────
  const twitchLive = url.match(/^twitch:(.+)$/i)
  if (twitchLive) {
    const channel = twitchLive[1].trim()
    src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(host)}&muted=false&autoplay=true`
    platform = 'Twitch'
    helpText = `Channel: ${channel} · Parent: ${host}`
  }

  // ─── Twitch VOD ───────────────────────────────────────────────────────────
  const twitchVod = url.match(/^twitch-vod:(.+)$/i)
  if (twitchVod) {
    const videoId = twitchVod[1].trim()
    src = `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&parent=${encodeURIComponent(host)}&muted=false&autoplay=true`
    platform = 'Twitch VOD'
    helpText = `Video ID: ${videoId} · Parent: ${host}`
  }

  // ─── Twitch clip ──────────────────────────────────────────────────────────
  const twitchClip = url.match(/^twitch-clip:(.+)$/i)
  if (twitchClip) {
    const slug = twitchClip[1].trim()
    src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&parent=${encodeURIComponent(host)}`
    platform = 'Twitch Clip'
    helpText = `Clip: ${slug} · Parent: ${host}`
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

      {/* Debug / help bar — shows the parent domain (critical for Twitch) */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-secondary font-mono">{platform}</span>
        <span className="font-mono truncate">{helpText}</span>
        {platform.startsWith('Twitch') && (
          <span className="ml-auto text-amber-500/80">
            ⚠ If the player is blank, the parent domain <code className="font-mono">{host}</code> must match this site's exact hostname.
          </span>
        )}
      </div>
    </div>
  )
}

/** Returns true if the given URL is a Twitch/YouTube embed URL. */
export function isEmbedUrl(url: string): boolean {
  return /^(twitch:|twitch-vod:|twitch-clip:|youtube:|youtube-live:)/i.test(url)
}
