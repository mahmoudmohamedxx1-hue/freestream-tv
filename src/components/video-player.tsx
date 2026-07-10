'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { AlertCircle, Loader2, Volume2, VolumeX, Maximize, Play, Pause } from 'lucide-react'

type VideoPlayerProps = {
  src: string
  poster?: string
  channelName?: string
  onError?: (msg: string) => void
}

export function VideoPlayer({ src, poster, channelName, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    // Defer state updates so we don't trigger them synchronously inside the effect body
    const resetTimer = requestAnimationFrame(() => {
      setLoading(true)
      setError(null)
    })

    // Reset previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const isHls = src.includes('.m3u8') || src.includes('m3u8')

    const onLoaded = () => {
      setLoading(false)
      video.play().then(() => setPlaying(true)).catch(() => {
        // Autoplay may fail if not muted
        setMuted(true)
        video.muted = true
        video.play().then(() => setPlaying(true)).catch(() => {})
      })
    }
    const onPlaying = () => {
      setLoading(false)
      setPlaying(true)
    }
    const onWait = () => setLoading(true)
    const onErr = () => {
      const msg = 'Stream could not be loaded. The source may be offline, geo-restricted, or no longer available.'
      setError(msg)
      setLoading(false)
      onError?.(msg)
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWait)
    video.addEventListener('error', onErr)

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError()
              break
            default:
              onErr()
              break
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = src
    } else {
      // Direct video file
      video.src = src
    }

    return () => {
      cancelAnimationFrame(resetTimer)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('waiting', onWait)
      video.removeEventListener('error', onErr)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src, onError])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const goFullscreen = () => {
    const c = containerRef.current
    if (!c) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      c.requestFullscreen()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group"
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        className="w-full h-full object-contain bg-black"
      />

      {/* Loading overlay */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-white/90">
            <Loader2 className="w-10 h-10 animate-spin text-red-500" />
            <span className="text-sm font-medium">Loading stream…</span>
            {channelName && (
              <span className="text-xs text-white/60">{channelName}</span>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="flex flex-col items-center gap-3 text-center max-w-md">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <h3 className="text-white font-semibold text-lg">Stream unavailable</h3>
            <p className="text-white/70 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white pointer-events-auto"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleMute}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white pointer-events-auto"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {channelName && (
              <span className="text-white/90 text-sm font-medium truncate flex-1">
                {channelName}
              </span>
            )}
            <button
              onClick={goFullscreen}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white pointer-events-auto ml-auto"
              aria-label="Fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
