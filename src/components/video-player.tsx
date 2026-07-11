'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { AlertCircle, Loader2, Volume2, VolumeX, Maximize, Play, Pause, SkipForward, Settings } from 'lucide-react'

type QualityLevel = {
  id: number
  label: string
  height: number
  bitrate: number
}

type VideoPlayerProps = {
  src: string
  poster?: string
  channelName?: string
  onError?: (msg: string) => void
  /** Called when user clicks "Skip to next" */
  onNext?: () => void
  /** If true, automatically calls onNext after a short delay when an error occurs */
  autoSkip?: boolean
  /** Global max quality cap (e.g., '720p' limits to 720p and below) */
  maxQuality?: 'auto' | '480p' | '720p' | '1080p'
}

export function VideoPlayer({ src, poster, channelName, onError, onNext, autoSkip = false, maxQuality = 'auto' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const errorCountRef = useRef(0)
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [levels, setLevels] = useState<QualityLevel[]>([])
  const [currentLevel, setCurrentLevel] = useState<number>(-1) // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState(false)

  const triggerError = useCallback((msg: string) => {
    setError(msg)
    setLoading(false)
    onError?.(msg)
    // Schedule auto-skip if enabled and we have a next handler
    if (autoSkip && onNext) {
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current)
      skipTimerRef.current = setTimeout(() => {
        onNext()
      }, 1800)
    }
  }, [autoSkip, onNext, onError])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    errorCountRef.current = 0
    if (skipTimerRef.current) {
      clearTimeout(skipTimerRef.current)
      skipTimerRef.current = null
    }

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
      triggerError(msg)
    }

    // Safety: if NO progress events fire for 30s, mark as error.
    // This timeout resets whenever the player emits progress/loaded/warning events,
    // so a slow-but-progressing stream won't trigger a false error.
    // NOTE: loadTimeout and resetLoadTimeout must be declared BEFORE the
    // addEventListener calls below, otherwise we hit a temporal dead zone error.
    let loadTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (loading) {
        triggerError('Stream took too long to load. Source may be offline.')
      }
    }, 30000)

    const resetLoadTimeout = () => {
      if (loadTimeout) clearTimeout(loadTimeout)
      // After we've successfully started playing, no more timeout needed
      if (!loading) return
      loadTimeout = setTimeout(() => {
        if (loading) {
          triggerError('Stream took too long to load. Source may be offline.')
        }
      }, 30000)
    }

    // Listen for HLS manifest/fragment loaded events to reset the timeout
    const onManifestParsed = () => resetLoadTimeout()
    const onLevelLoaded = () => resetLoadTimeout()
    const onFragLoaded = () => resetLoadTimeout()
    const onFragLoading = () => resetLoadTimeout()
    const onBufferAppended = () => resetLoadTimeout()

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWait)
    video.addEventListener('error', onErr)
    // Reset the load timeout on video progress events too
    video.addEventListener('progress', resetLoadTimeout)
    video.addEventListener('canplay', resetLoadTimeout)
    video.addEventListener('canplaythrough', resetLoadTimeout)

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 6,
      })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      // Reset the load timeout whenever HLS makes progress
      hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed)
      hls.on(Hls.Events.LEVEL_LOADED, onLevelLoaded)
      hls.on(Hls.Events.FRAG_LOADED, onFragLoaded)
      hls.on(Hls.Events.FRAG_LOADING, onFragLoading)
      hls.on(Hls.Events.BUFFER_APPENDED, onBufferAppended)
      // Track quality levels for the quality selector
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const qs = hls.levels.map((lvl, i) => ({
          id: i,
          label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}kbps`,
          height: lvl.height || 0,
          bitrate: lvl.bitrate,
        }))
        setLevels(qs)
        // Apply max quality cap from global setting
        if (maxQuality !== 'auto' && hls.levels.length > 0) {
          const maxH = maxQuality === '480p' ? 480 : maxQuality === '720p' ? 720 : 1080
          // Find the highest level at or below maxH
          let bestIdx = -1
          let bestH = 0
          hls.levels.forEach((lvl, i) => {
            const h = lvl.height || 0
            if (h <= maxH && h > bestH) { bestH = h; bestIdx = i }
          })
          if (bestIdx !== -1) {
            hls.currentLevel = bestIdx
            setCurrentLevel(bestIdx)
          } else {
            hls.currentLevel = -1 // auto
            setCurrentLevel(-1)
          }
        } else {
          hls.currentLevel = -1 // auto by default
          setCurrentLevel(-1)
        }
      })
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level)
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          errorCountRef.current += 1
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover once, then give up
              if (errorCountRef.current <= 1) {
                hls.startLoad()
              } else {
                clearTimeout(loadTimeout)
                onErr()
              }
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (errorCountRef.current <= 1) {
                hls.recoverMediaError()
              } else {
                clearTimeout(loadTimeout)
                onErr()
              }
              break
            default:
              clearTimeout(loadTimeout)
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
      if (loadTimeout) clearTimeout(loadTimeout)
      if (skipTimerRef.current) {
        clearTimeout(skipTimerRef.current)
        skipTimerRef.current = null
      }
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('waiting', onWait)
      video.removeEventListener('error', onErr)
      video.removeEventListener('progress', resetLoadTimeout)
      video.removeEventListener('canplay', resetLoadTimeout)
      video.removeEventListener('canplaythrough', resetLoadTimeout)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src])

  // Re-evaluate auto-skip scheduling if the autoSkip flag or onNext changes
  useEffect(() => {
    if (!error || !autoSkip || !onNext) return
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current)
    skipTimerRef.current = setTimeout(() => {
      onNext()
    }, 1800)
    return () => {
      if (skipTimerRef.current) {
        clearTimeout(skipTimerRef.current)
        skipTimerRef.current = null
      }
    }
  }, [error, autoSkip, onNext])

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

  const setQuality = (levelId: number) => {
    if (!hlsRef.current) return
    hlsRef.current.currentLevel = levelId // -1 = auto
    setCurrentLevel(levelId)
    setShowQualityMenu(false)
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
            {autoSkip && onNext && (
              <p className="text-white/50 text-xs">
                Automatically skipping to next channel…
              </p>
            )}
            {onNext && (
              <button
                onClick={onNext}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition text-sm font-medium"
              >
                <SkipForward className="w-4 h-4" />
                Skip to next channel
              </button>
            )}
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
            {onNext && (
              <button
                onClick={onNext}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white pointer-events-auto"
                aria-label="Next channel"
                title="Next channel"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            )}
            {/* Quality selector */}
            {levels.length > 0 && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowQualityMenu(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition text-white text-xs font-medium pointer-events-auto"
                  aria-label="Quality"
                  title="Stream quality"
                >
                  <Settings className="w-4 h-4" />
                  <span>{currentLevel === -1 ? 'Auto' : levels.find(l => l.id === currentLevel)?.label || 'Auto'}</span>
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden min-w-[120px] shadow-xl pointer-events-auto">
                    <button
                      onClick={() => setQuality(-1)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-white/10 transition ${currentLevel === -1 ? 'text-primary bg-primary/10' : 'text-white'}`}
                    >
                      Auto
                    </button>
                    {levels.slice().reverse().map(lvl => (
                      <button
                        key={lvl.id}
                        onClick={() => setQuality(lvl.id)}
                        className={`w-full px-3 py-2 text-left text-xs hover:bg-white/10 transition ${currentLevel === lvl.id ? 'text-primary bg-primary/10' : 'text-white'}`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={goFullscreen}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white pointer-events-auto"
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
