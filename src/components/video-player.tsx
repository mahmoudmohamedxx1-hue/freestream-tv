'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { AlertCircle, Loader2, Volume2, VolumeX, Maximize, Play, Pause, SkipForward, Settings, Subtitles } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  /** Optional ref to expose the underlying <video> element to the parent (for PiP, keyboard shortcuts) */
  externalVideoRef?: React.MutableRefObject<HTMLVideoElement | null>
}

export function VideoPlayer({ src, poster, channelName, onError, onNext, autoSkip = false, maxQuality = 'auto', externalVideoRef }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Keep the external ref in sync with our internal ref
  useEffect(() => {
    if (externalVideoRef) {
      externalVideoRef.current = videoRef.current
    }
  }, [externalVideoRef, src]) // re-sync when src changes (video element may be recreated)
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
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([])
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1) // -1 = off
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true) // always visible on mobile
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      // Detect Twitch streams — they need special handling
      const isTwitch = src.includes('ttvnw.net') || src.includes('twitch.tv')

      const hls = new Hls({
        enableWorker: true,
        // Twitch live playlists have 2-second segments; disable low-latency mode
        // which can cause issues with non-LL-HLS streams
        lowLatencyMode: false,
        backBufferLength: 30,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 6,
        // For Twitch: set proper credentials mode and headers
        xhrSetup: (xhr, url) => {
          // Twitch CDN requires credentials for some segments
          if (isTwitch || url.includes('ttvnw.net')) {
            xhr.withCredentials = false
          }
        },
        // For Twitch: tune for live 2s segments
        ...(isTwitch ? {
          liveDurationInfinity: true,
          liveBackBufferLength: 30,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startFragPrefetch: true,
          testBandwidth: false,
          // Don't auto-start quality switching for Twitch (causes buffering)
          abrEwmaDefaultEstimate: 1000000,
        } : {}),
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
      // Track subtitle tracks
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const subs = hls.subtitleTracks.map((tr, i) => ({
          id: i,
          name: tr.name || tr.lang || `Track ${i + 1}`,
          lang: tr.lang || '',
        }))
        setSubtitleTracks(subs)
        setActiveSubtitle(-1) // off by default
      })
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        const subs = hls.subtitleTracks.map((tr, i) => ({
          id: i,
          name: tr.name || tr.lang || `Track ${i + 1}`,
          lang: tr.lang || '',
        }))
        setSubtitleTracks(subs)
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        // Log ALL errors for debugging (non-fatal too)
        console.warn('[HLS] Error:', data.type, data.details, data.fatal ? '(FATAL)' : '', data.url ? `url=${data.url.substring(0, 80)}` : '')
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
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current)
        controlsTimerRef.current = null
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

  // Toggle controls visibility (for mobile: tap to show/hide)
  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => {
      if (!showQualityMenu && !showSubtitleMenu && videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false)
      }
    }, 4000)
  }, [showQualityMenu, showSubtitleMenu])

  // Tap on video area = toggle controls (mobile) or toggle play (desktop)
  const handleVideoTap = useCallback(() => {
    if (showQualityMenu || showSubtitleMenu) {
      setShowQualityMenu(false)
      setShowSubtitleMenu(false)
      return
    }
    if (controlsVisible) {
      togglePlay()
    } else {
      showControls()
    }
  }, [controlsVisible, showQualityMenu, showSubtitleMenu, showControls])

  const setQuality = (levelId: number) => {
    if (!hlsRef.current) return
    hlsRef.current.currentLevel = levelId // -1 = auto
    setCurrentLevel(levelId)
    setShowQualityMenu(false)
  }

  const setSubtitle = (trackId: number) => {
    if (!hlsRef.current) return
    hlsRef.current.subtitleTrack = trackId // -1 = off
    setActiveSubtitle(trackId)
    setShowSubtitleMenu(false)
  }

  const goFullscreen = () => {
    const c = containerRef.current
    const v = videoRef.current
    if (!c) return
    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen()
      return
    }
    // Try standard fullscreen
    if (c.requestFullscreen) {
      c.requestFullscreen()
    } else if ((c as any).webkitRequestFullscreen) {
      // Safari desktop
      ;(c as any).webkitRequestFullscreen()
    } else if ((c as any).webkitEnterFullscreen) {
      // iOS Safari — enter fullscreen on the video element itself
      ;(c as any).webkitEnterFullscreen()
    } else if (v && (v as any).webkitEnterFullscreen) {
      // iOS Safari fallback — video element fullscreen
      ;(v as any).webkitEnterFullscreen()
    } else if ((c as any).msRequestFullscreen) {
      // IE/Edge legacy
      ;(c as any).msRequestFullscreen()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group"
      onClick={handleVideoTap}
      onTouchStart={(e) => { /* Don't preventDefault — let click fire */ }}
      onMouseMove={showControls}
      onMouseLeave={() => {
        // On desktop, hide controls when mouse leaves (if playing)
        if (videoRef.current && !videoRef.current.paused && !showQualityMenu && !showSubtitleMenu) {
          setControlsVisible(false)
        }
      }}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        // @ts-expect-error — webkit-playsinline is iOS-specific
        webkit-playsinline="true"
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

      {/* Controls overlay — visible on hover (desktop) or tap (mobile) */}
      {!error && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-200 pointer-events-none',
            controlsVisible ? 'opacity-100' : 'opacity-0',
            'group-hover:opacity-100',
          )}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay() }}
              className="p-2.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition text-white pointer-events-auto touch-manipulation"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute() }}
              className="p-2.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition text-white pointer-events-auto touch-manipulation"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {channelName && (
              <span className="text-white/90 text-xs sm:text-sm font-medium truncate flex-1 min-w-0">
                {channelName}
              </span>
            )}
            {onNext && (
              <button
                onClick={(e) => { e.stopPropagation(); onNext() }}
                className="p-2.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition text-white pointer-events-auto touch-manipulation"
                aria-label="Next channel"
                title="Next channel"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            )}
            {/* Subtitle selector — only shows if subtitles are available */}
            {subtitleTracks.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSubtitleMenu(v => !v) }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-full hover:bg-white/20 active:bg-white/30 transition text-white text-xs font-medium pointer-events-auto touch-manipulation',
                    activeSubtitle !== -1 ? 'bg-primary/80' : 'bg-white/10',
                  )}
                  aria-label="Subtitles"
                  title="Subtitles / Captions"
                >
                  <Subtitles className="w-4 h-4" />
                  <span className="hidden sm:inline">{activeSubtitle === -1 ? 'CC' : subtitleTracks.find(s => s.id === activeSubtitle)?.name || 'CC'}</span>
                </button>
                {showSubtitleMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden min-w-[140px] shadow-xl pointer-events-auto">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSubtitle(-1) }}
                      className={`w-full px-3 py-2.5 text-left text-xs hover:bg-white/10 transition ${activeSubtitle === -1 ? 'text-primary bg-primary/10' : 'text-white'}`}
                    >
                      Off
                    </button>
                    {subtitleTracks.map(sub => (
                      <button
                        key={sub.id}
                        onClick={(e) => { e.stopPropagation(); setSubtitle(sub.id) }}
                        className={`w-full px-3 py-2.5 text-left text-xs hover:bg-white/10 transition ${activeSubtitle === sub.id ? 'text-primary bg-primary/10' : 'text-white'}`}
                      >
                        {sub.name}{sub.lang && ` (${sub.lang})`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Quality selector — always visible, shows available levels or "Single" */}
            <div className="relative ml-auto">
              <button
                onClick={(e) => { e.stopPropagation(); if (levels.length > 1) setShowQualityMenu(v => !v) }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition text-white text-xs font-medium pointer-events-auto touch-manipulation"
                aria-label="Quality"
                title={levels.length > 1 ? 'Stream quality' : 'Single quality stream'}
              >
                <Settings className="w-4 h-4" />
                <span>
                  {levels.length === 0
                    ? 'Auto'
                    : currentLevel === -1
                      ? 'Auto'
                      : levels.find(l => l.id === currentLevel)?.label || 'Auto'}
                </span>
              </button>
              {showQualityMenu && levels.length > 1 && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden min-w-[120px] shadow-xl pointer-events-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setQuality(-1) }}
                    className={`w-full px-3 py-2.5 text-left text-xs hover:bg-white/10 transition ${currentLevel === -1 ? 'text-primary bg-primary/10' : 'text-white'}`}
                  >
                    Auto
                  </button>
                  {levels.slice().reverse().map(lvl => (
                    <button
                      key={lvl.id}
                      onClick={(e) => { e.stopPropagation(); setQuality(lvl.id) }}
                      className={`w-full px-3 py-2.5 text-left text-xs hover:bg-white/10 transition ${currentLevel === lvl.id ? 'text-primary bg-primary/10' : 'text-white'}`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); goFullscreen() }}
              className="p-2.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition text-white pointer-events-auto touch-manipulation"
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
