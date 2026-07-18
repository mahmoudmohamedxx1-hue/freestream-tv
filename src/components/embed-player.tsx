'use client'

import { useState, useEffect, useRef } from 'react'
import { VideoPlayer } from './video-player'

/**
 * Twitch / YouTube embed player.
 *
 * Used when a channel's URL starts with one of:
 *   • twitch:<channel>           → Twitch live (via server-side HLS proxy → VideoPlayer)
 *   • twitch-vod:<videoId>       → Twitch VOD (iframe embed)
 *   • twitch-clip:<slug>         → Twitch clip (iframe embed)
 *   • youtube:<videoId>          → YouTube video (iframe embed)
 *   • youtube-live:<channelId>   → YouTube live (iframe embed)
 *
 * TWITCH LIVE STREAMS:
 * Twitch's iframe embed requires the `parent` param to EXACTLY match the
 * browser's hostname. On preview subdomains, Twitch rejects the embed.
 *
 * Fix: for twitch:CHANNEL URLs, we call /api/twitch which resolves the HLS
 * URL server-side (via Twitch GQL + usher API), then render our own
 * VideoPlayer (HLS.js) with that URL. No Twitch iframe needed — the stream
 * plays in our <video> element with full controls, PiP, quality selection.
 *
 * For VODs/clips/YouTube, we use the iframe embed (no parent restriction).
 */

type EmbedPlayerProps = {
  url: string
  channelName?: string
  poster?: string
  onError?: (msg: string) => void
  onNext?: () => void
  autoSkip?: boolean
  maxQuality?: 'auto' | '480p' | '720p' | '1080p'
  externalVideoRef?: React.MutableRefObject<HTMLVideoElement | null>
}

export function EmbedPlayer({
  url,
  channelName,
  poster,
  onError,
  onNext,
  autoSkip,
  maxQuality,
  externalVideoRef,
}: EmbedPlayerProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Twitch live stream resolution state ────────────────────────────────
  const [twitchHlsUrl, setTwitchHlsUrl] = useState<string | null>(null)
  const [twitchStatus, setTwitchStatus] = useState<'idle' | 'resolving' | 'ok' | 'offline' | 'error'>('idle')
  const [twitchMessage, setTwitchMessage] = useState('')

  // Reset state when URL changes
  useEffect(() => {
    setLoaded(false)
    setError(null)
    setTwitchHlsUrl(null)
    setTwitchStatus('idle')
    setTwitchMessage('')
  }, [url])

  // ─── For Twitch live streams, resolve the HLS URL via our server proxy ─
  const twitchLive = url.match(/^twitch:([a-zA-Z0-9_]{4,25})$/i)
  useEffect(() => {
    if (!twitchLive) return
    const channel = twitchLive[1].trim()

    let cancelled = false
    setTwitchStatus('resolving')
    setTwitchMessage(`Resolving Twitch stream for "${channel}"…`)

    fetch(`/api/twitch?channel=${encodeURIComponent(channel)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.ok && data.url) {
          setTwitchHlsUrl(data.url)
          setTwitchStatus('ok')
          setTwitchMessage('Stream resolved — loading HLS…')
        } else {
          setTwitchStatus('offline')
          setTwitchMessage(data.error || `Channel "${channel}" is offline`)
        }
      })
      .catch(e => {
        if (cancelled) return
        setTwitchStatus('error')
        setTwitchMessage(`Failed to resolve: ${e.message}`)
      })

    return () => { cancelled = true }
  }, [twitchLive])

  // ─── Twitch live: if resolved, render VideoPlayer directly ──────────────
  if (twitchLive && twitchStatus === 'ok' && twitchHlsUrl) {
    return (
      <VideoPlayer
        src={twitchHlsUrl}
        poster={poster}
        channelName={channelName}
        onError={onError}
        onNext={onNext}
        autoSkip={autoSkip}
        maxQuality={maxQuality}
        externalVideoRef={externalVideoRef}
      />
    )
  }

  // ─── Twitch live: show resolving / offline / error states ───────────────
  if (twitchLive) {
    const channel = twitchLive[1].trim()
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
                Twitch channels only stream when live. Try during a broadcast, or open directly on Twitch.
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
