'use client'

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
  const h = window.location.hostname
  // For preview environments (e.g. preview-<bot-id>.space-z.ai), use the full host.
  // For localhost dev, parent=localhost works.
  return h
}

export function EmbedPlayer({ url, channelName, poster }: EmbedPlayerProps) {
  const host = detectHost()

  // ─── Twitch live ──────────────────────────────────────────────────────────
  const twitchLive = url.match(/^twitch:(.+)$/i)
  if (twitchLive) {
    const channel = twitchLive[1].trim()
    const src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(host)}&muted=false&autoplay=true`
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={src}
          title={channelName || `Twitch — ${channel}`}
          allowFullScreen
          className="w-full h-full"
          frameBorder={0}
          allow="autoplay; fullscreen"
        />
      </div>
    )
  }

  // ─── Twitch VOD ───────────────────────────────────────────────────────────
  const twitchVod = url.match(/^twitch-vod:(.+)$/i)
  if (twitchVod) {
    const videoId = twitchVod[1].trim()
    const src = `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&parent=${encodeURIComponent(host)}&muted=false&autoplay=true`
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={src}
          title={channelName || `Twitch VOD — ${videoId}`}
          allowFullScreen
          className="w-full h-full"
          frameBorder={0}
          allow="autoplay; fullscreen"
        />
      </div>
    )
  }

  // ─── Twitch clip ──────────────────────────────────────────────────────────
  const twitchClip = url.match(/^twitch-clip:(.+)$/i)
  if (twitchClip) {
    const slug = twitchClip[1].trim()
    const src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&parent=${encodeURIComponent(host)}`
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={src}
          title={channelName || `Twitch clip — ${slug}`}
          allowFullScreen
          className="w-full h-full"
          frameBorder={0}
          allow="autoplay; fullscreen"
        />
      </div>
    )
  }

  // ─── YouTube video ────────────────────────────────────────────────────────
  const ytVideo = url.match(/^youtube:(.+)$/i)
  if (ytVideo) {
    const videoId = ytVideo[1].trim()
    const src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={src}
          title={channelName || `YouTube — ${videoId}`}
          allowFullScreen
          className="w-full h-full"
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    )
  }

  // ─── YouTube live (by channel ID) ─────────────────────────────────────────
  const ytLive = url.match(/^youtube-live:(.+)$/i)
  if (ytLive) {
    const channelId = ytLive[1].trim()
    const src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&autoplay=1`
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={src}
          title={channelName || `YouTube Live — ${channelId}`}
          allowFullScreen
          className="w-full h-full"
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    )
  }

  // ─── Fallback: not an embeddable URL ──────────────────────────────────────
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

/** Returns true if the given URL is a Twitch/YouTube embed URL. */
export function isEmbedUrl(url: string): boolean {
  return /^(twitch:|twitch-vod:|twitch-clip:|youtube:|youtube-live:)/i.test(url)
}
