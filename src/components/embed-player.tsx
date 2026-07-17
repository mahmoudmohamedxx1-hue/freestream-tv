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
 * TWITCH PARENT PARAMETER — THE CRITICAL ISSUE:
 * Twitch requires the `parent` query param to be the EXACT hostname of the
 * page hosting the iframe. Not a parent domain, not a subdomain — the EXACT
 * hostname the browser shows in the address bar.
 *
 * For our preview at `preview-<uuid>.space-z.ai`, that means parent must be
 * `preview-<uuid>.space-z.ai` — nothing else. If we send multiple parent
 * params and ANY of them don't match the actual hostname, Twitch rejects
 * the embed with "player.twitch.tv refused to connect".
 *
 * Solution: detect the exact hostname at runtime and send ONLY that as parent.
 * If Twitch still rejects (rare — happens when the hostname has unusual chars
 * that Twitch's validator dislikes), fall back to a "Open on Twitch" link.
 */

type EmbedPlayerProps = {
  url: string
  channelName?: string
  poster?: string
}

export function EmbedPlayer({ url, channelName, poster }: EmbedPlayerProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [twitchBlocked, setTwitchBlocked] = useState(false)

  // Reset state when URL changes
  useEffect(() => {
    setLoaded(false)
    setError(null)
    setTwitchBlocked(false)
  }, [url])

  // Detect if Twitch embed is blocked (iframe refuses to load)
  // We use a timeout — if onLoad doesn't fire within 8s, assume blocked.
  useEffect(() => {
    if (!url.startsWith('twitch')) return
    setTwitchBlocked(false)
    const timer = setTimeout(() => {
      if (!loaded) {
        setTwitchBlocked(true)
      }
    }, 8000)
    return () => clearTimeout(timer)
  }, [url, loaded])

  // The EXACT current hostname — this is what Twitch requires for parent
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

  // Build the iframe src
  let src = ''
  let platform = ''
  let helpText = ''
  let twitchChannelName = ''

  // ─── Twitch live ──────────────────────────────────────────────────────────
  const twitchLive = url.match(/^twitch:(.+)$/i)
  if (twitchLive) {
    twitchChannelName = twitchLive[1].trim()
    src = `https://player.twitch.tv/?channel=${encodeURIComponent(twitchChannelName)}&parent=${encodeURIComponent(currentHost)}&muted=false&autoplay=true`
    platform = 'Twitch'
    helpText = `Channel: ${twitchChannelName}`
  }

  // ─── Twitch VOD ───────────────────────────────────────────────────────────
  const twitchVod = url.match(/^twitch-vod:(.+)$/i)
  if (twitchVod) {
    twitchChannelName = twitchVod[1].trim()
    src = `https://player.twitch.tv/?video=${encodeURIComponent(twitchChannelName)}&parent=${encodeURIComponent(currentHost)}&muted=false&autoplay=true`
    platform = 'Twitch VOD'
    helpText = `Video ID: ${twitchChannelName}`
  }

  // ─── Twitch clip ──────────────────────────────────────────────────────────
  const twitchClip = url.match(/^twitch-clip:(.+)$/i)
  if (twitchClip) {
    twitchChannelName = twitchClip[1].trim()
    src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(twitchChannelName)}&parent=${encodeURIComponent(currentHost)}`
    platform = 'Twitch Clip'
    helpText = `Clip: ${twitchChannelName}`
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

  // Twitch channel name validation
  if (platform.startsWith('Twitch') && twitchChannelName) {
    if (!/^[a-zA-Z0-9_]{4,25}$/.test(twitchChannelName)) {
      return (
        <div className="aspect-video w-full rounded-xl bg-card flex items-center justify-center text-muted-foreground">
          <div className="text-center px-4">
            <p className="text-sm font-semibold text-amber-500">⚠ Invalid Twitch channel name</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">&quot;{twitchChannelName}&quot;</p>
            <p className="text-xs text-muted-foreground mt-2">
              Twitch channel names must be 4-25 characters, letters/numbers/underscores only.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-3">
              Try: <code className="font-mono text-primary">twitch:espn</code>,{' '}
              <code className="font-mono text-primary">twitch:nfl</code>
            </p>
          </div>
        </div>
      )
    }
  }

  // Twitch blocked fallback — show "Open on Twitch" button
  if (twitchBlocked && platform.startsWith('Twitch')) {
    const twitchUrl = platform === 'Twitch VOD'
      ? `https://www.twitch.tv/videos/${twitchChannelName}`
      : platform === 'Twitch Clip'
        ? `https://clips.twitch.tv/${twitchChannelName}`
        : `https://www.twitch.tv/${twitchChannelName}`
    return (
      <div className="aspect-video w-full rounded-xl bg-card flex items-center justify-center text-muted-foreground border border-border">
        <div className="text-center px-4 max-w-md">
          <p className="text-sm font-semibold text-purple-400 mb-2">🎮 Twitch embed blocked</p>
          <p className="text-xs text-muted-foreground mb-3">
            Twitch refused to load the embedded player. This happens when the parent domain
            (<code className="font-mono text-foreground/80">{currentHost}</code>) isn&apos;t
            accepted by Twitch&apos;s security policy.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Channel: <strong className="text-foreground">{twitchChannelName}</strong>
          </p>
          <a
            href={twitchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition"
          >
            ▶ Open on Twitch.com
          </a>
          <p className="text-xs text-muted-foreground/70 mt-3">
            Opens in a new tab — the stream will play directly on Twitch.
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
              {platform.startsWith('Twitch') && (
                <p className="text-xs text-muted-foreground/70 mt-2">
                  parent: {currentHost}
                </p>
              )}
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

      {/* Debug / help bar */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-secondary font-mono">{platform}</span>
        <span className="font-mono truncate">{helpText}</span>
        {platform.startsWith('Twitch') && (
          <span className="font-mono text-muted-foreground/60 ml-auto">
            parent: {currentHost}
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
