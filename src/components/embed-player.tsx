'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Twitch / YouTube embed player.
 *
 * Used when a channel's URL starts with one of:
 *   • twitch:<channel>           → Twitch live (via server-side HLS proxy)
 *   • twitch-vod:<videoId>       → Twitch VOD (iframe embed)
 *   • twitch-clip:<slug>         → Twitch clip (iframe embed)
 *   • youtube:<videoId>          → YouTube video (iframe embed)
 *   • youtube-live:<channelId>   → YouTube live (iframe embed)
 *
 * TWITCH LIVE STREAMS — HOW THIS WORKS:
 * Twitch's iframe embed (player.twitch.tv) requires the `parent` query param
 * to EXACTLY match the browser's hostname. On preview subdomains like
 * `preview-<uuid>.space-z.ai`, Twitch rejects the embed with
 * "player.twitch.tv refused to connect".
 *
 * To fix this, we use a server-side proxy at /api/twitch that:
 *   1. Fetches a PlaybackAccessToken from Twitch's GQL API
 *   2. Calls the usher API to get the HLS playlist URL
 *   3. Returns the URL to the client
 *   4. The client loads it in HLS.js (our existing video player)
 *
 * This completely bypasses the iframe restriction. The stream plays in our
 * own <video> element, no Twitch iframe needed.
 *
 * For Twitch VODs and clips, we still use the iframe (they don't have the
 * same parent restriction issue for short content).
 *
 * For YouTube, we use the official iframe embed (no parent restriction).
 */

type EmbedPlayerProps = {
  url: string
  channelName?: string
  poster?: string
  /** Called when a Twitch live stream is resolved — parent can switch to HLS player */
  onTwitchResolved?: (hlsUrl: string, channel: string) => void
}

export function EmbedPlayer({ url, channelName, poster, onTwitchResolved }: EmbedPlayerProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [twitchStatus, setTwitchStatus] = useState<'idle' | 'resolving' | 'ok' | 'offline' | 'error'>('idle')
  const [twitchMessage, setTwitchMessage] = useState('')
  const resolvedRef = useRef(false)

  // Reset state when URL changes
  useEffect(() => {
    setLoaded(false)
    setError(null)
    setTwitchStatus('idle')
    setTwitchMessage('')
    resolvedRef.current = false
  }, [url])

  // For Twitch live streams, resolve the HLS URL via our server proxy
  const twitchLive = url.match(/^twitch:(.+)$/i)
  useEffect(() => {
    if (!twitchLive || resolvedRef.current) return
    const channel = twitchLive[1].trim()
    if (!channel) return

    resolvedRef.current = true
    setTwitchStatus('resolving')
    setTwitchMessage(`Resolving Twitch stream for "${channel}"…`)

    fetch(`/api/twitch?channel=${encodeURIComponent(channel)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.url) {
          setTwitchStatus('ok')
          setTwitchMessage(`Stream resolved — loading HLS…`)
          onTwitchResolved?.(data.url, channel)
        } else {
          setTwitchStatus('offline')
          setTwitchMessage(data.error || `Channel "${channel}" is offline`)
        }
      })
      .catch(e => {
        setTwitchStatus('error')
        setTwitchMessage(`Failed to resolve: ${e.message}`)
      })
  }, [twitchLive, onTwitchResolved])

  // ─── If this is a Twitch live stream, show the resolving status ────────
  if (twitchLive) {
    const channel = twitchLive[1].trim()

    // Validate channel name
    if (!/^[a-zA-Z0-9_]{4,25}$/.test(channel)) {
      return (
        <div className="aspect-video w-full rounded-xl bg-card flex items-center justify-center text-muted-foreground">
          <div className="text-center px-4">
            <p className="text-sm font-semibold text-amber-500">⚠ Invalid Twitch channel name</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">&quot;{channel}&quot;</p>
            <p className="text-xs text-muted-foreground mt-2">
              Channel names must be 4-25 characters, letters/numbers/underscores only.
            </p>
          </div>
        </div>
      )
    }

    // Show resolving / offline / error states
    if (twitchStatus !== 'ok') {
      const twitchUrl = `https://www.twitch.tv/${channel}`
      return (
        <div className="aspect-video w-full rounded-xl bg-card flex items-center justify-center text-muted-foreground border border-border">
          <div className="text-center px-4 max-w-md">
            {twitchStatus === 'resolving' && (
              <>
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-foreground/80">{twitchMessage}</p>
                <p className="text-xs text-muted-foreground mt-2 font-mono">twitch:{channel}</p>
              </>
            )}

            {twitchStatus === 'offline' && (
              <>
                <p className="text-sm font-semibold text-amber-500 mb-2">📺 Channel is offline</p>
                <p className="text-xs text-muted-foreground mb-3">{twitchMessage}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Twitch channels only stream when live. Try a 24/7 channel or check back during a broadcast.
                </p>
                <a
                  href={twitchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition"
                >
                  ▶ Open {channel} on Twitch
                </a>
              </>
            )}

            {twitchStatus === 'error' && (
              <>
                <p className="text-sm font-semibold text-destructive mb-2">⚠ Error</p>
                <p className="text-xs text-muted-foreground mb-3">{twitchMessage}</p>
                <a
                  href={twitchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition"
                >
                  ▶ Open on Twitch
                </a>
              </>
            )}

            {twitchStatus === 'idle' && (
              <p className="text-sm">Loading…</p>
            )}
          </div>
        </div>
      )
    }

    // If resolved (status === 'ok'), the parent component will render the HLS player
    // via onTwitchResolved callback. Show a brief "loading HLS" message.
    return (
      <div className="aspect-video w-full rounded-xl bg-black flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-foreground/80">Loading Twitch stream…</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">twitch:{channel}</p>
        </div>
      </div>
    )
  }

  // ─── For non-Twitch-live URLs, use iframe embed ────────────────────────
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  let src = ''
  let platform = ''
  let helpText = ''

  // Twitch VOD
  const twitchVod = url.match(/^twitch-vod:(.+)$/i)
  if (twitchVod) {
    const videoId = twitchVod[1].trim()
    src = `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&parent=${encodeURIComponent(currentHost)}&muted=false&autoplay=true`
    platform = 'Twitch VOD'
    helpText = `Video ID: ${videoId}`
  }

  // Twitch clip
  const twitchClip = url.match(/^twitch-clip:(.+)$/i)
  if (twitchClip) {
    const slug = twitchClip[1].trim()
    src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&parent=${encodeURIComponent(currentHost)}`
    platform = 'Twitch Clip'
    helpText = `Clip: ${slug}`
  }

  // YouTube video
  const ytVideo = url.match(/^youtube:(.+)$/i)
  if (ytVideo) {
    const videoId = ytVideo[1].trim()
    src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`
    platform = 'YouTube'
    helpText = `Video ID: ${videoId}`
  }

  // YouTube live
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
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black relative">
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
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-secondary font-mono">{platform}</span>
        <span className="font-mono truncate">{helpText}</span>
      </div>
    </div>
  )
}

/** Returns true if the given URL is a Twitch/YouTube embed URL. */
export function isEmbedUrl(url: string): boolean {
  return /^(twitch:|twitch-vod:|twitch-clip:|youtube:|youtube-live:)/i.test(url)
}
