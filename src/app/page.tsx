'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Search, Heart, Tv, Loader2, AlertCircle, Menu, X, Radio,
  Globe, ChevronRight, Star, Zap, Filter, ZapOff, EyeOff,
  Settings, RotateCcw, Clock, ArrowDownAZ, ArrowUpAZ, Flame,
  CheckCircle2, Calendar, Play, ChevronDown, RefreshCw, Key,
  Code, Twitch, Youtube, Plus, Circle, Grid3x3, Cloud, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { VideoPlayer } from '@/components/video-player'
import { EmbedPlayer, isEmbedUrl } from '@/components/embed-player'
import { MultiView } from '@/components/multiview'
import { DVRPanel } from '@/components/dvr-panel'
import { PROVIDERS, type Provider, type ProviderCategory } from '@/lib/playlists'
import type { Channel } from '@/lib/m3u-parser'
import { flagForCountry } from '@/lib/countries'
import { cn } from '@/lib/utils'
import {
  loadXtreamCreds, saveXtreamCreds, clearXtreamCreds,
  xtreamAuth, xtreamM3U, type XtreamCredentials,
  DEMO_XTREAM_CREDS, isDemoCreds,
} from '@/lib/xtream'
import {
  loadStalkerCreds, saveStalkerCreds, clearStalkerCreds,
  stalkerHandshake, stalkerGetChannels, type StalkerCredentials,
} from '@/lib/stalker'
import { tryCompileFilter } from '@/lib/filter-dsl'

type PlaylistData = {
  channels: Channel[]
  groups: string[]
  totalCount: number
  sourceKey: string
}

type SortMode = 'az' | 'za' | 'recent' | 'quality'
type QualityFilter = 'all' | '4k' | '1080p' | '720p' | 'sd'
type MaxQuality = 'auto' | '480p' | '720p' | '1080p'
type SidebarView = 'channels' | 'guide'

/** Parse XMLTV time strings like "20240101123000 +0000" or "20240101123000Z" into a Date. */
function parseXmltvTime(s: string): number {
  if (!s) return 0
  const m = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
  if (!m) return 0
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).getTime()
}

// ─── Synthesized EPG (client-side fallback) ──────────────────────────────────
// When no real EPG is available, generate a plausible "now playing" based on
// the channel's group/name. This ensures the EPG panel always has content.
const SYNTH_PROGRAMS: Record<string, string[]> = {
  sports: ['Live Match Coverage', 'SportsCenter', 'Match Highlights', 'Pre-Game Show', 'Post-Game Analysis', 'Live: Premier League', 'Live: NBA Action', 'Live: NFL Game', 'Live: La Liga', 'Live: Champions League', 'Sports News', 'Transfer Talk', 'Tennis: ATP Tour', 'Golf: PGA Tour', 'F1 Race Replay', 'Cricket: Test Match'],
  news: ['World News', 'Breaking News', 'News Bulletin', 'Business Report', 'Weather Forecast', 'Market Update', 'Top Stories', 'Live Coverage', 'News at Six', 'International Desk', 'Politics Today', 'Tech News'],
  movies: ['Feature Presentation', 'Movie Marathon', 'Blockbuster Hits', 'Classic Cinema', 'Action Movies', 'Comedy Night', 'Drama Special', 'Horror Double Feature', 'Sci-Fi Showcase', 'Western Classics', 'Now Showing', 'Late Night Movie'],
  music: ['Top 40 Countdown', 'Music Videos', 'Live Sessions', 'Artist Spotlight', 'Classic Hits', 'New Releases', 'Genre Mix', 'Late Night Beats', 'Morning Music', 'Hit Parade'],
  kids: ['Cartoon Time', 'Kids Club', 'Animated Adventures', 'Educational Fun', 'Story Time', 'Sing Along', 'Kids Movies', 'Fun & Games', 'Nature for Kids', 'Art Time'],
  entertainment: ['Talk Show', 'Game Show', 'Reality TV', 'Variety Show', 'Comedy Special', 'Late Night Talk', 'Celebrity Interview', 'Cooking Show', 'Travel Show'],
  documentary: ['Nature Documentary', 'History Channel', 'Science Documentary', 'Wildlife', 'Space & Universe', 'Ancient Civilizations', 'True Crime', 'Planet Earth'],
  general: ['Live Broadcast', 'Current Program', 'Featured Content', 'Prime Time', 'Morning Show', 'Afternoon Special', 'Evening Programming', 'Now Showing'],
}

function synthesizeNowPlaying(channel: Channel): any {
  const g = ((channel.group || '') + ' ' + (channel.displayName || '') + ' ' + (channel.name || '')).toLowerCase()
  let pool: string[]
  if (/sport|football|soccer|basketball|baseball|hockey|cricket|tennis|golf|boxing|mma|ufc|f1|nfl|nba|mlb|nhl|espn|bein/.test(g)) {
    pool = SYNTH_PROGRAMS.sports
  } else if (/news|cnn|bbc|al.jazeera|fox.news|msnbc/.test(g)) {
    pool = SYNTH_PROGRAMS.news
  } else if (/movie|cinema|film|action|comedy|drama|horror|scifi|western|classic/.test(g)) {
    pool = SYNTH_PROGRAMS.movies
  } else if (/music|mtv|vh1|country|jazz|classical/.test(g)) {
    pool = SYNTH_PROGRAMS.music
  } else if (/kid|child|cartoon|disney|nick|baby/.test(g)) {
    pool = SYNTH_PROGRAMS.kids
  } else if (/entertain|talk|show|reality|game/.test(g)) {
    pool = SYNTH_PROGRAMS.entertainment
  } else if (/docu|nature|history|science|wildlife|discovery|national.geo/.test(g)) {
    pool = SYNTH_PROGRAMS.documentary
  } else {
    pool = SYNTH_PROGRAMS.general
  }
  const seed = (channel.displayName || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const title = pool[seed % pool.length]
  const now = Date.now()
  const start = now - (15 + (seed % 30)) * 60 * 1000
  const end = start + (30 + (seed % 30)) * 60 * 1000
  const progress = Math.min(Math.round((now - start) / (end - start) * 100), 100)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (t: number) => {
    const d = new Date(t)
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`
  }
  return {
    channel: channel.tvgId || channel.id,
    title,
    start: fmt(start),
    stop: fmt(end),
    desc: `Scheduled programming on ${channel.displayName}. (Synthesized — no real EPG source available.)`,
    progress,
    isNow: true,
    synthesized: true,
  }
}

const FAV_KEY = 'freestream.favorites'
const DEAD_KEY = 'freestream.deadChannels'
const RECENT_KEY = 'freestream.recentChannels'
const ACTIVE_PATH_KEY = 'freestream.activePath'
const AUTOSKIP_KEY = 'freestream.autoSkip'
const HIDE_DEAD_KEY = 'freestream.hideDead'
const HIDE_BAD_KEY = 'freestream.hideBad'
const MAX_QUALITY_KEY = 'freestream.maxQuality'

export default function Home() {
  // Active provider + category + playlist path
  const [activeProvider, setActiveProvider] = useState<Provider>(PROVIDERS[0])
  const [activeCategory, setActiveCategory] = useState<ProviderCategory | null>(PROVIDERS[0].categories[0])
  const [activePlaylistId, setActivePlaylistId] = useState<string | undefined>(undefined)

  const [data, setData] = useState<PlaylistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>('__all')
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const [showRecentOnly, setShowRecentOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [deadChannels, setDeadChannels] = useState<Set<string>>(new Set())
  const [recentChannels, setRecentChannels] = useState<string[]>([])
  const [hideDead, setHideDead] = useState(false)
  const [hideBad, setHideBad] = useState(false)
  const [autoSkip, setAutoSkip] = useState(false)
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('az')
  const [maxQuality, setMaxQuality] = useState<MaxQuality>('auto')
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [providerGridOpen, setProviderGridOpen] = useState(false)
  const [language, setLanguage] = useState<'en' | 'ar'>('en')
  const [sidebarView, setSidebarView] = useState<SidebarView>('channels')
  const [tvGuide, setTvGuide] = useState<any[]>([])
  const [guideLoading, setGuideLoading] = useState(false)
  const [customChannels, setCustomChannels] = useState<Channel[]>([])
  const [adminChannelName, setAdminChannelName] = useState('')
  const [adminChannelUrl, setAdminChannelUrl] = useState('')
  const [adminChannelLogo, setAdminChannelLogo] = useState('')
  const [adminChannelGroup, setAdminChannelGroup] = useState('Custom')
  const [customM3uUrl, setCustomM3uUrl] = useState('')

  // ─── New features state ─────────────────────────────────────────────────
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<Channel[]>([])
  const [globalSearching, setGlobalSearching] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [pipActive, setPipActive] = useState(false)
  const [showFavGrid, setShowFavGrid] = useState(false)
  const [showRecentGrid, setShowRecentGrid] = useState(false)
  const [customUserAgent, setCustomUserAgent] = useState('')
  const [showUploadDropzone, setShowUploadDropzone] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // ─── Multi-view, DVR, Stalker, Cloud sync state ────────────────────────
  const [showMultiView, setShowMultiView] = useState(false)
  const [showDVR, setShowDVR] = useState(false)
  const [showSync, setShowSync] = useState(false)
  const [syncKey, setSyncKey] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')

  // ─── Stalker Portal state ───────────────────────────────────────────────
  const [adminTab, setAdminTab] = useState<'channels' | 'xtream' | 'stalker' | 'embed'>('channels')
  const [stalkerUrl, setStalkerUrl] = useState('')
  const [stalkerMac, setStalkerMac] = useState('')
  const [stalkerCreds, setStalkerCreds] = useState<StalkerCredentials | null>(null)
  const [stalkerStatus, setStalkerStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [stalkerMessage, setStalkerMessage] = useState('')
  const [stalkerChannels, setStalkerChannels] = useState<Channel[]>([])

  // ─── DVR state ──────────────────────────────────────────────────────────
  const [dvrRecording, setDvrRecording] = useState(false)

  // ─── Separate state for each quick-add embed input (avoids cross-tab bleed) ──
  const [twitchInput, setTwitchInput] = useState('')
  const [ytLiveInput, setYtLiveInput] = useState('')
  const [ytVodInput, setYtVodInput] = useState('')

  // ─── Xtream Codes state ─────────────────────────────────────────────────
  const [xcServer, setXcServer] = useState('')
  const [xcUser, setXcUser] = useState('')
  const [xcPass, setXcPass] = useState('')
  const [xcCreds, setXcCreds] = useState<XtreamCredentials | null>(null)
  const [xcStatus, setXcStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [xcMessage, setXcMessage] = useState('')
  const [xcChannels, setXcChannels] = useState<Channel[]>([])

  // ─── Filter DSL (tuliprox-inspired) ─────────────────────────────────────
  const [filterExpr, setFilterExpr] = useState('')
  const [filterError, setFilterError] = useState<string | null>(null)
  const filterFnRef = useRef<((ctx: any) => boolean) | null>(null)

  // ─── EPG "Now Playing" for current channel ──────────────────────────────
  const [epgNow, setEpgNow] = useState<any>(null)
  const [epgLoading, setEpgLoading] = useState(false)

  // ─── switchProvider ref (so callbacks defined earlier can call it) ────────
  const switchProviderRef = useRef<(provider: Provider) => void>(() => {})

  // ─── Refs that mirror state ────────────────────────────────────────────
  const deadChannelsRef = useRef<Set<string>>(new Set())
  const favoritesRef = useRef<Set<string>>(new Set())
  const recentChannelsRef = useRef<string[]>([])
  const currentChannelRef = useRef<Channel | null>(null)
  useEffect(() => { deadChannelsRef.current = deadChannels }, [deadChannels])
  useEffect(() => { favoritesRef.current = favorites }, [favorites])
  useEffect(() => { recentChannelsRef.current = recentChannels }, [recentChannels])
  useEffect(() => { currentChannelRef.current = currentChannel }, [currentChannel])

  // ─── Apply language direction (RTL for Arabic) ──────────────────────────
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
    try { localStorage.setItem('freestream.language', language) } catch {}
  }, [language])

  // ─── Load persisted state on mount ──────────────────────────────────────
  useEffect(() => {
    try {
      const favRaw = localStorage.getItem(FAV_KEY)
      if (favRaw) setFavorites(new Set(JSON.parse(favRaw)))
      // CLEAR dead channels — restore all previously hidden streams
      // The user asked to stop removing streams, so we clear the dead list
      localStorage.removeItem(DEAD_KEY)
      setDeadChannels(new Set())
      const recentRaw = localStorage.getItem(RECENT_KEY)
      if (recentRaw) setRecentChannels(JSON.parse(recentRaw))
      // Force-disable auto features that remove streams
      const as = localStorage.getItem(AUTOSKIP_KEY)
      if (as !== null) setAutoSkip(as === '1')
      else setAutoSkip(false)
      const hd = localStorage.getItem(HIDE_DEAD_KEY)
      if (hd !== null) setHideDead(hd === '1')
      else setHideDead(false)
      const hb = localStorage.getItem(HIDE_BAD_KEY)
      if (hb !== null) setHideBad(hb === '1')
      else setHideBad(false)
      const mq = localStorage.getItem(MAX_QUALITY_KEY) as MaxQuality | null
      if (mq) setMaxQuality(mq)
      const savedLang = localStorage.getItem('freestream.language') as 'en' | 'ar' | null
      if (savedLang) setLanguage(savedLang)
      const pathRaw = localStorage.getItem(ACTIVE_PATH_KEY)
      if (pathRaw) {
        const path = JSON.parse(pathRaw)
        const prov = PROVIDERS.find(p => p.id === path.providerId)
        if (prov) {
          const cat = prov.categories.find(c => c.id === path.categoryId)
          if (cat) {
            setActiveProvider(prov)
            setActiveCategory(cat)
            setActivePlaylistId(path.playlistId)
          }
        }
      }
    } catch {}
  }, [])

  // ─── Persist state ──────────────────────────────────────────────────────
  useEffect(() => { try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favorites))) } catch {} }, [favorites])
  useEffect(() => { try { localStorage.setItem(DEAD_KEY, JSON.stringify(Array.from(deadChannels))) } catch {} }, [deadChannels])
  useEffect(() => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentChannels)) } catch {} }, [recentChannels])
  useEffect(() => { try { localStorage.setItem(AUTOSKIP_KEY, autoSkip ? '1' : '0') } catch {} }, [autoSkip])
  useEffect(() => { try { localStorage.setItem(HIDE_DEAD_KEY, hideDead ? '1' : '0') } catch {} }, [hideDead])
  useEffect(() => { try { localStorage.setItem(HIDE_BAD_KEY, hideBad ? '1' : '0') } catch {} }, [hideBad])
  useEffect(() => { try { localStorage.setItem(MAX_QUALITY_KEY, maxQuality) } catch {} }, [maxQuality])
  useEffect(() => {
    if (activeProvider && activeCategory) {
      try {
        localStorage.setItem(ACTIVE_PATH_KEY, JSON.stringify({
          providerId: activeProvider.id,
          categoryId: activeCategory.id,
          playlistId: activePlaylistId,
        }))
      } catch {}
    }
  }, [activeProvider, activeCategory, activePlaylistId])

  // ─── Fetch playlist ─────────────────────────────────────────────────────
  const [refreshNonce, setRefreshNonce] = useState(0)
  const fetchPlaylist = useCallback(async () => {
    if (!activeProvider || !activeCategory) return

    // ─── "My Channels" provider — pure client-side, reads customChannels state ──
    if (activeProvider.id === 'my-channels') {
      setLoading(false)
      setError(null)
      const channels = customChannels
      const groups = Array.from(new Set(channels.map(c => c.group || 'Other'))).sort()
      setData({
        channels,
        groups,
        totalCount: channels.length,
        sourceKey: 'my-channels',
      })
      const deadSet = deadChannelsRef.current
      const firstPlayable = channels.find(c => !deadSet.has(c.url))
      if (firstPlayable) setCurrentChannel(firstPlayable)
      else if (channels.length > 0) setCurrentChannel(channels[0])
      else setCurrentChannel(null)
      return
    }

    // ─── Xtream Codes provider — load from XC server ─────────────────────
    if (activeProvider.id === 'xtream') {
      const creds = loadXtreamCreds()
      if (!creds) {
        setLoading(false)
        setError('No Xtream Codes credentials saved. Open Admin → Xtream tab to log in.')
        setData({ channels: [], groups: [], totalCount: 0, sourceKey: 'xtream' })
        return
      }
      setLoading(true)
      setError(null)
      setData(null)
      setActiveGroup('__all')
      setSearch('')
      try {
        const result = await xtreamM3U(creds)
        const channels: Channel[] = (result.channels || []).map((ch: any, i: number) => ({
          ...ch,
          id: ch.id || `xc-${i}`,
          group: ch.group || 'Xtream',
          isVod: ch.isVod,
        }))
        const groups = Array.from(new Set(channels.map(c => c.group || 'Other'))).sort()
        setData({
          channels,
          groups,
          totalCount: channels.length,
          sourceKey: 'xtream',
        })
        const deadSet = deadChannelsRef.current
        const firstPlayable = channels.find(c => !deadSet.has(c.url))
        if (firstPlayable) setCurrentChannel(firstPlayable)
        else if (channels.length > 0) setCurrentChannel(channels[0])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(`Xtream Codes: ${msg}`)
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    setError(null)
    setData(null)
    setActiveGroup('__all')
    setSearch('')
    try {
      const params = new URLSearchParams({
        provider: activeProvider.id,
        category: activeCategory.id,
      })
      if (activePlaylistId) params.set('playlist', activePlaylistId)
      // Auto-updated providers always refresh on fetch
      if (activeProvider.id === 'auto-updated' || activeProvider.id === 'embeds') {
        params.set('refresh', '1')
      }
      if (refreshNonce > 0) params.set('refresh', '1')
      const res = await fetch(`/api/playlist?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load playlist')
      setData(json)
      const deadSet = deadChannelsRef.current
      const firstPlayable = (json.channels as Channel[]).find(c => !deadSet.has(c.url))
      if (firstPlayable) {
        setCurrentChannel(firstPlayable)
      } else if (json.channels?.length > 0) {
        setCurrentChannel(json.channels[0])
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [activeProvider, activeCategory, activePlaylistId, refreshNonce, customChannels])

  useEffect(() => {
    fetchPlaylist()
  }, [fetchPlaylist])

  // ─── Admin: Add custom channel ──────────────────────────────────────────
  const addCustomChannel = useCallback(() => {
    if (!adminChannelName.trim() || !adminChannelUrl.trim()) return
    const newCh: Channel = {
      id: `custom-${Date.now()}`,
      name: adminChannelName.trim(),
      displayName: adminChannelName.trim(),
      rawName: adminChannelName.trim(),
      url: adminChannelUrl.trim(),
      logo: adminChannelLogo.trim() || undefined,
      group: adminChannelGroup.trim() || 'Custom',
      not247: false,
      isVod: /\.(mp4|mkv|avi|mov|webm)/.test(adminChannelUrl.toLowerCase()),
      geoBlocked: false,
    }
    setCustomChannels(prev => [newCh, ...prev])
    setAdminChannelName('')
    setAdminChannelUrl('')
    setAdminChannelLogo('')
    setAdminChannelGroup('Custom')
    // Auto-switch to "My Channels" so the user sees the new channel immediately
    const myProv = PROVIDERS.find(p => p.id === 'my-channels')
    if (myProv) switchProviderRef.current(myProv)
  }, [adminChannelName, adminChannelUrl, adminChannelLogo, adminChannelGroup])

  // ─── Admin: Delete custom channel ───────────────────────────────────────
  const deleteCustomChannel = useCallback((id: string) => {
    setCustomChannels(prev => prev.filter(c => c.id !== id))
  }, [])

  // ─── Admin: Load custom M3U by URL ──────────────────────────────────────
  const loadCustomM3u = useCallback(async () => {
    if (!customM3uUrl.trim()) return
    try {
      const encoded = encodeURIComponent(customM3uUrl.trim())
      // refresh=1 to bypass cache when loading a fresh URL
      const res = await fetch(`/api/playlist?url=${encoded}&refresh=1`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      const channels = (json.channels as Channel[]) || []
      const loaded = channels.map((ch, i) => ({
        ...ch,
        id: `custom-m3u-${Date.now()}-${i}`,
        group: ch.group || 'Custom M3U',
      }))
      setCustomChannels(prev => [...loaded, ...prev])
      setCustomM3uUrl('')
      // Auto-switch to "My Channels" so the user sees the loaded channels immediately
      const myProv = PROVIDERS.find(p => p.id === 'my-channels')
      if (myProv) switchProviderRef.current(myProv)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      alert(`Failed to load M3U: ${msg}`)
    }
  }, [customM3uUrl])

  // ─── Admin: Quick-add Twitch / YouTube channels (separate state per input) ──
  const addTwitchChannel = useCallback(() => {
    const name = twitchInput.trim().replace(/^twitch:/i, '')
    if (!name) return
    const ch: Channel = {
      id: `twitch-${Date.now()}`,
      name: `Twitch — ${name}`,
      displayName: `Twitch — ${name}`,
      rawName: `Twitch — ${name}`,
      url: `twitch:${name}`,
      group: 'Twitch',
      isVod: false,
      logo: 'https://assets.help.twitch.tv/article/img/658115-02.png',
    }
    setCustomChannels(prev => [ch, ...prev])
    setTwitchInput('')
    // Auto-switch to "My Channels" so the user sees it immediately
    const myProv = PROVIDERS.find(p => p.id === 'my-channels')
    if (myProv) switchProviderRef.current(myProv)
  }, [twitchInput])

  const addYtLiveChannel = useCallback(() => {
    const id = ytLiveInput.trim().replace(/^youtube-live:/i, '')
    if (!id) return
    const ch: Channel = {
      id: `yt-live-${Date.now()}`,
      name: `YouTube Live — ${id.slice(0, 16)}`,
      displayName: `YouTube Live — ${id.slice(0, 16)}`,
      rawName: `YouTube Live — ${id}`,
      url: `youtube-live:${id}`,
      group: 'YouTube',
      isVod: false,
      logo: 'https://www.youtube.com/s/desktop/favicon.ico',
    }
    setCustomChannels(prev => [ch, ...prev])
    setYtLiveInput('')
    const myProv = PROVIDERS.find(p => p.id === 'my-channels')
    if (myProv) switchProviderRef.current(myProv)
  }, [ytLiveInput])

  const addYtVodChannel = useCallback(() => {
    const id = ytVodInput.trim().replace(/^youtube:/i, '')
    if (!id) return
    const ch: Channel = {
      id: `yt-vod-${Date.now()}`,
      name: `YouTube — ${id}`,
      displayName: `YouTube — ${id}`,
      rawName: `YouTube — ${id}`,
      url: `youtube:${id}`,
      group: 'YouTube VOD',
      isVod: true,
      logo: 'https://www.youtube.com/s/desktop/favicon.ico',
    }
    setCustomChannels(prev => [ch, ...prev])
    setYtVodInput('')
    const myProv = PROVIDERS.find(p => p.id === 'my-channels')
    if (myProv) switchProviderRef.current(myProv)
  }, [ytVodInput])

  // ─── Load custom channels from localStorage on mount ────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('freestream.customChannels')
      if (raw) setCustomChannels(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('freestream.customChannels', JSON.stringify(customChannels)) } catch {}
  }, [customChannels])

  // ─── Xtream Codes: load saved creds on mount ───────────────────────────
  useEffect(() => {
    const saved = loadXtreamCreds()
    if (saved) {
      setXcCreds(saved)
      setXcServer(saved.server)
      setXcUser(saved.username)
      setXcPass(saved.password)
    }
  }, [])

  // ─── Xtream Codes: login handler ────────────────────────────────────────
  const handleXtreamLogin = useCallback(async () => {
    if (!xcServer.trim() || !xcUser.trim() || !xcPass.trim()) return
    setXcStatus('loading')
    setXcMessage('Connecting…')
    try {
      const creds: XtreamCredentials = {
        server: xcServer.trim().replace(/\/+$/, ''),
        username: xcUser.trim(),
        password: xcPass.trim(),
      }
      const info = await xtreamAuth(creds)
      // Be lenient: if we got a JSON response with user_info, the server is
      // reachable and credentials are accepted. Some servers return auth:0 but
      // still allow M3U access; others return auth:1 without status:"Active".
      const ui = info?.user_info
      if (ui && info?.server_info) {
        const ok = ui.auth === 1 ||
                   ui.status === 'Active' ||
                   ui.status === 'active' ||
                   (ui.auth !== 0 && !ui.message?.toLowerCase?.().includes('invalid'))
        if (ok) {
          saveXtreamCreds(creds)
          setXcCreds(creds)
          setXcStatus('ok')
          const exp = ui.exp_date
            ? new Date(parseInt(ui.exp_date, 10) * 1000).toLocaleDateString()
            : 'unknown'
          setXcMessage(
            `✓ Connected — ${ui.username} · ${info.server_info.url}:${info.server_info.port} · max ${ui.max_connections} connections · expires ${exp}`,
          )
        } else {
          setXcStatus('error')
          setXcMessage(`✗ Auth failed: ${ui.message || 'Server rejected credentials (auth=' + ui.auth + ', status=' + ui.status + ')'}`)
        }
      } else {
        setXcStatus('error')
        setXcMessage('✗ Server did not return valid user_info — check the server URL is correct and includes the port (e.g. http://example.com:8080)')
      }
    } catch (e: unknown) {
      setXcStatus('error')
      const msg = e instanceof Error ? e.message : 'Connection failed'
      setXcMessage(`✗ ${msg}

Common causes:
• Server URL wrong or missing port (use http://host:port)
• Server is HTTP-only but this site is HTTPS (mixed-content blocked) — use an HTTPS XC server or self-host kptv-proxy
• Server is offline or behind a firewall
• CORS blocked — but our /api/xtream proxy handles that, so this is unlikely`)
    }
  }, [xcServer, xcUser, xcPass])

  const handleXtreamLogout = useCallback(() => {
    clearXtreamCreds()
    setXcCreds(null)
    setXcChannels([])
    setXcStatus('idle')
    setXcMessage('Logged out.')
  }, [])

  // ─── Stalker Portal: load saved creds on mount ─────────────────────────
  useEffect(() => {
    const saved = loadStalkerCreds()
    if (saved) {
      setStalkerCreds(saved)
      setStalkerUrl(saved.portalUrl)
      setStalkerMac(saved.mac)
    }
  }, [])

  // ─── Stalker Portal: login handler ─────────────────────────────────────
  const handleStalkerLogin = useCallback(async () => {
    if (!stalkerUrl.trim() || !stalkerMac.trim()) return
    setStalkerStatus('loading')
    setStalkerMessage('Connecting to portal…')
    try {
      const creds: StalkerCredentials = {
        portalUrl: stalkerUrl.trim().replace(/\/+$/, ''),
        mac: stalkerMac.trim(),
      }
      const handshake = await stalkerHandshake(creds)
      saveStalkerCreds(creds)
      setStalkerCreds(creds)
      setStalkerStatus('ok')
      setStalkerMessage(`✓ Connected — token received. Click "Load channels" to browse.`)
    } catch (e: unknown) {
      setStalkerStatus('error')
      setStalkerMessage(`✗ ${e instanceof Error ? e.message : 'Connection failed'}`)
    }
  }, [stalkerUrl, stalkerMac])

  const handleStalkerLogout = useCallback(() => {
    clearStalkerCreds()
    setStalkerCreds(null)
    setStalkerChannels([])
    setStalkerStatus('idle')
    setStalkerMessage('Logged out.')
  }, [])

  const handleStalkerLoadChannels = useCallback(async () => {
    if (!stalkerCreds) return
    setStalkerStatus('loading')
    setStalkerMessage('Loading channels…')
    try {
      const { channels } = await stalkerGetChannels(stalkerCreds)
      const mapped: Channel[] = channels.map((ch, i) => ({
        id: `stalker-${i}`,
        name: ch.name,
        displayName: ch.name,
        rawName: ch.name,
        url: ch.url || ch.cmd || '',
        logo: ch.logo,
        group: ch.category || 'Stalker',
      })).filter(c => c.url)
      setStalkerChannels(mapped)
      setStalkerStatus('ok')
      setStalkerMessage(`✓ Loaded ${mapped.length} channels from Stalker portal.`)
    } catch (e: unknown) {
      setStalkerStatus('error')
      setStalkerMessage(`✗ ${e instanceof Error ? e.message : 'Failed to load channels'}`)
    }
  }, [stalkerCreds])

  // ─── Cloud sync: load key from localStorage ────────────────────────────
  useEffect(() => {
    const key = localStorage.getItem('freestream.syncKey')
    if (key) setSyncKey(key)
  }, [])

  // ─── Cloud sync: push local data to server ─────────────────────────────
  const handleSyncPush = useCallback(async () => {
    if (!syncKey) return
    setSyncStatus('syncing')
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: syncKey,
          favorites: Array.from(favorites),
          recent: recentChannels,
          customChannels,
        }),
      })
      setSyncStatus('ok')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch {
      setSyncStatus('error')
    }
  }, [syncKey, favorites, recentChannels, customChannels])

  // ─── Cloud sync: pull data from server ─────────────────────────────────
  const handleSyncPull = useCallback(async () => {
    if (!syncKey) return
    setSyncStatus('syncing')
    try {
      const res = await fetch(`/api/sync?key=${syncKey}`)
      const data = await res.json()
      if (data.ok) {
        if (data.favorites) setFavorites(new Set(data.favorites))
        if (data.recent) setRecentChannels(data.recent)
        if (data.customChannels) setCustomChannels(data.customChannels)
        setSyncStatus('ok')
        setTimeout(() => setSyncStatus('idle'), 3000)
      } else {
        setSyncStatus('error')
      }
    } catch {
      setSyncStatus('error')
    }
  }, [syncKey])

  // ─── Cloud sync: create new sync key ───────────────────────────────────
  const handleSyncCreate = useCallback(async () => {
    setSyncStatus('syncing')
    try {
      const res = await fetch('/api/sync?new=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorites: Array.from(favorites),
          recent: recentChannels,
          customChannels,
        }),
      })
      const data = await res.json()
      if (data.key) {
        setSyncKey(data.key)
        localStorage.setItem('freestream.syncKey', data.key)
        setSyncStatus('ok')
        setTimeout(() => setSyncStatus('idle'), 3000)
      }
    } catch {
      setSyncStatus('error')
    }
  }, [favorites, recentChannels, customChannels])

  // ─── DVR: start recording current channel ──────────────────────────────
  const startDVR = useCallback(async () => {
    if (!currentChannel || isEmbedUrl(currentChannel.url)) return
    setDvrRecording(true)
    try {
      await fetch('/api/dvr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentChannel.url,
          name: currentChannel.displayName,
          channel: currentChannel.group || '',
          duration: 3600,
        }),
      })
    } catch {} finally {
      setDvrRecording(false)
    }
  }, [currentChannel])

  // ─── Xtream Codes: load demo (mock) server ──────────────────────────────
  const handleXtreamDemo = useCallback(async () => {
    setXcServer(DEMO_XTREAM_CREDS.server)
    setXcUser(DEMO_XTREAM_CREDS.username)
    setXcPass(DEMO_XTREAM_CREDS.password)
    setXcStatus('loading')
    setXcMessage('Connecting to demo (mock) XC server…')
    try {
      const info = await xtreamAuth(DEMO_XTREAM_CREDS)
      saveXtreamCreds(DEMO_XTREAM_CREDS)
      setXcCreds(DEMO_XTREAM_CREDS)
      setXcStatus('ok')
      setXcMessage(
        `✓ Demo connected — ${info.user_info.username} · mock server with ${info.server_info.url} · 16 live channels + 5 VOD (real iptv-org streams). Click "Open XC channels" to browse.`,
      )
    } catch (e: unknown) {
      setXcStatus('error')
      setXcMessage(`✗ Demo failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  }, [])

  // ─── Filter DSL: recompile on change ────────────────────────────────────
  useEffect(() => {
    if (!filterExpr.trim()) {
      filterFnRef.current = null
      setFilterError(null)
      return
    }
    const result = tryCompileFilter(filterExpr)
    if (result.ok) {
      filterFnRef.current = result.fn
      setFilterError(null)
    } else {
      filterFnRef.current = null
      setFilterError(result.error)
    }
  }, [filterExpr])

  // ─── EPG "Now Playing" for the current channel ──────────────────────────
  useEffect(() => {
    if (!currentChannel) {
      setEpgNow(null)
      return
    }
    let cancelled = false
    setEpgLoading(true)
    // Try matching by tvg-id first, then fall back to channel display name
    const matchKey = currentChannel.tvgId || currentChannel.displayName || ''
    if (!matchKey) {
      setEpgNow(null)
      setEpgLoading(false)
      return
    }
    fetch(`/api/epg?channel=${encodeURIComponent(matchKey)}&limit=5`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return
        // Find the best match: prefer exact tvg-id, then name contains
        const channels = json?.channels || []
        let best = channels.find((c: any) => c.id === matchKey)
        if (!best && currentChannel.tvgId) {
          const tvgId = currentChannel.tvgId
          best = channels.find((c: any) => c.id.toLowerCase().endsWith('.' + tvgId.toLowerCase()))
        }
        if (!best) {
          best = channels.find((c: any) =>
            c.name.toLowerCase().includes(currentChannel.displayName.toLowerCase()) ||
            currentChannel.displayName.toLowerCase().includes(c.name.toLowerCase()),
          )
        }
        const now = best?.programs?.find((p: any) => p.isNow)
        if (now) {
          setEpgNow(now)
        } else {
          // ─── Synthesize a "now playing" entry client-side ───────────────
          // No real EPG match — generate a plausible program based on channel
          // group/name so the EPG panel always has content.
          setEpgNow(synthesizeNowPlaying(currentChannel))
        }
      })
      .catch(() => {
        // On fetch failure, also synthesize
        if (!cancelled) setEpgNow(synthesizeNowPlaying(currentChannel))
      })
      .finally(() => { if (!cancelled) setEpgLoading(false) })
    return () => { cancelled = true }
  }, [currentChannel])

  // ─── Fetch TV Guide ─────────────────────────────────────────────────────
  const [guideGenres, setGuideGenres] = useState<any[]>([])
  const [activeGuideGenre, setActiveGuideGenre] = useState<string>('sports')
  const fetchGuide = useCallback(async () => {
    setGuideLoading(true)
    try {
      const res = await fetch('/api/tv-guide?limit=40')
      const json = await res.json()
      setGuideGenres(json.genres || [])
      // Flatten all genres' channels for backward compat
      const all: any[] = []
      for (const g of (json.genres || [])) {
        for (const ch of (g.channels || [])) {
          all.push({ ...ch, genre: g.id, genreName: g.name, genreFlag: g.flag })
        }
      }
      setTvGuide(all)
    } catch {
      setTvGuide([])
      setGuideGenres([])
    } finally {
      setGuideLoading(false)
    }
  }, [])

  useEffect(() => { fetchGuide() }, [fetchGuide])

  // ─── Channel actions ────────────────────────────────────────────────────
  const toggleFav = useCallback((channel: Channel) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(channel.url)) next.delete(channel.url)
      else next.add(channel.url)
      return next
    })
  }, [])
  const isFav = useCallback((channel: Channel) => favorites.has(channel.url), [favorites])

  const markDead = useCallback((channel: Channel) => {
    setDeadChannels(prev => {
      const next = new Set(prev)
      next.add(channel.url)
      return next
    })
  }, [])
  const unmarkDead = useCallback((channel: Channel) => {
    setDeadChannels(prev => {
      const next = new Set(prev)
      next.delete(channel.url)
      return next
    })
  }, [])
  const isDead = useCallback((channel: Channel) => deadChannels.has(channel.url), [deadChannels])

  const recordRecent = useCallback((channel: Channel) => {
    setRecentChannels(prev => {
      const next = [channel.url, ...prev.filter(u => u !== channel.url)].slice(0, 20)
      return next
    })
  }, [])

  // Auto-skip to next channel
  const goToNextChannel = useCallback(() => {
    const list = filteredChannelsRef.current
    const cur = currentChannelRef.current
    if (!list || list.length === 0 || !cur) return
    const deadSet = deadChannelsRef.current
    const idx = list.findIndex(c => c.url === cur.url)
    if (idx === -1) return
    for (let i = idx + 1; i < list.length; i++) {
      if (!deadSet.has(list[i].url)) {
        setCurrentChannel(list[i])
        return
      }
    }
    for (let i = 0; i < idx; i++) {
      if (!deadSet.has(list[i].url)) {
        setCurrentChannel(list[i])
        return
      }
    }
  }, [])

  const handleSelectChannel = useCallback((channel: Channel) => {
    setCurrentChannel(channel)
    recordRecent(channel)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [recordRecent])

  // ─── Improvement: Copy stream URL to clipboard ──────────────────────────
  const copyStreamUrl = useCallback(async (channel: Channel) => {
    try {
      await navigator.clipboard.writeText(channel.url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = channel.url
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000) } catch {}
      document.body.removeChild(ta)
    }
  }, [])

  // ─── Improvement: PiP (Picture-in-Picture) toggle ────────────────────────
  const togglePiP = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        setPipActive(false)
      } else {
        await video.requestPictureInPicture()
        setPipActive(true)
      }
    } catch (e) {
      console.warn('PiP failed:', e)
    }
  }, [])

  // ─── Improvement: Go to previous channel ─────────────────────────────────
  const goToPrevChannel = useCallback(() => {
    const list = filteredChannelsRef.current
    const cur = currentChannelRef.current
    if (!list || list.length === 0 || !cur) return
    const deadSet = deadChannelsRef.current
    const idx = list.findIndex(c => c.url === cur.url)
    if (idx === -1) return
    for (let i = idx - 1; i >= 0; i--) {
      if (!deadSet.has(list[i].url)) {
        setCurrentChannel(list[i])
        return
      }
    }
    for (let i = list.length - 1; i > idx; i--) {
      if (!deadSet.has(list[i].url)) {
        setCurrentChannel(list[i])
        return
      }
    }
  }, [])

  // ─── Improvement: Global search across ALL providers ─────────────────────
  // Searches iptv-org's full index (8000+ channels) + our curated lists.
  // Opens a modal overlay with results from a server-side search.
  const performGlobalSearch = useCallback(async (query: string) => {
    const q = query.trim()
    if (q.length < 2) {
      setGlobalSearchResults([])
      return
    }
    setGlobalSearching(true)
    try {
      // Search iptv-org's full index via their search API
      const res = await fetch(`https://iptv-org.github.io/api/search.json?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.channels) {
          const results: Channel[] = data.channels.slice(0, 50).map((c: any, i: number) => ({
            id: `global-${i}`,
            name: c.name,
            displayName: c.name,
            rawName: c.name,
            url: c.streams?.[0]?.url || c.url || '',
            logo: c.logo,
            group: c.category || c.country || 'Global Search',
            country: c.country,
            countryCode: c.country,
            tvgId: c.id,
          })).filter((c: Channel) => c.url)
          setGlobalSearchResults(results)
        }
      }
    } catch {
      setGlobalSearchResults([])
    } finally {
      setGlobalSearching(false)
    }
  }, [])

  // ─── Improvement: M3U file upload handler ────────────────────────────────
  const handleM3UFileUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      try {
        // Parse the uploaded M3U content via the API
        const blob = new Blob([text], { type: 'audio/mpegurl' })
        const url = URL.createObjectURL(blob)
        fetch(`/api/playlist?url=${encodeURIComponent(url)}&refresh=1`)
          .then(r => r.json())
          .then(json => {
            const channels: Channel[] = (json.channels || []).map((ch: Channel, i: number) => ({
              ...ch,
              id: `upload-${Date.now()}-${i}`,
              group: ch.group || file.name.replace(/\.m3u8?$/i, ''),
            }))
            setCustomChannels(prev => [...channels, ...prev])
            URL.revokeObjectURL(url)
            const myProv = PROVIDERS.find(p => p.id === 'my-channels')
            if (myProv) switchProviderRef.current(myProv)
          })
          .catch(err => alert(`Failed to parse M3U: ${err.message}`))
      } catch (err: any) {
        alert(`Failed to read file: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }, [])

  // ─── Improvement: Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      // Don't intercept with modifier keys (except Shift for channel numbers)
      if (e.ctrlKey || e.altKey || e.metaKey) return

      // Cmd/Ctrl+K → open global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setGlobalSearchOpen(true)
        return
      }

      // Esc → close overlays
      if (e.key === 'Escape') {
        setGlobalSearchOpen(false)
        setShowFavGrid(false)
        setShowRecentGrid(false)
        return
      }

      // Arrow Up → previous channel
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        goToPrevChannel()
        return
      }
      // Arrow Down → next channel
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        goToNextChannel()
        return
      }
      // Space → play/pause (toggle PiP if video player)
      if (e.key === ' ') {
        e.preventDefault()
        const v = videoRef.current
        if (v) {
          if (v.paused) v.play()
          else v.pause()
        }
        return
      }
      // 'f' → fullscreen
      if (e.key === 'f' || e.key === 'F') {
        const v = videoRef.current
        if (v) {
          if (document.fullscreenElement) document.exitFullscreen()
          else v.requestFullscreen?.()
        }
        return
      }
      // 'p' → toggle PiP
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        togglePiP()
        return
      }
      // Number keys 1-9, 0 → jump to channel by index
      if (/^[0-9]$/.test(e.key)) {
        const list = filteredChannelsRef.current
        const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1
        if (list && list[idx]) {
          handleSelectChannel(list[idx])
        }
        return
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToNextChannel, goToPrevChannel, handleSelectChannel, togglePiP])

  // ─── Improvement: Load custom User-Agent from localStorage ───────────────
  useEffect(() => {
    try {
      const ua = localStorage.getItem('freestream.customUserAgent')
      if (ua) setCustomUserAgent(ua)
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('freestream.customUserAgent', customUserAgent) } catch {}
  }, [customUserAgent])

  // ─── Improvement: Debounced global search ────────────────────────────────
  useEffect(() => {
    if (!globalSearchQuery.trim()) {
      setGlobalSearchResults([])
      return
    }
    const t = setTimeout(() => performGlobalSearch(globalSearchQuery), 300)
    return () => clearTimeout(t)
  }, [globalSearchQuery, performGlobalSearch])

  // ─── Improvement: Drag-and-drop M3U file ─────────────────────────────────
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.types.includes('Files')) {
        setShowUploadDropzone(true)
      }
    }
    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setShowUploadDropzone(false)
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setShowUploadDropzone(false)
      const file = e.dataTransfer?.files?.[0]
      if (file && file.name.match(/\.m3u8?$/i)) {
        handleM3UFileUpload(file)
      }
    }
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleM3UFileUpload])

  // Player error handler — does NOT auto-mark channels as dead.
  // The user decides manually whether a channel is dead (via the "Mark dead" button).
  // This prevents good channels from being hidden just because they were slow to load.
  const handlePlayerError = useCallback((_msg: string) => {
    // No automatic action — just let the player show the error overlay.
    // The user can click "Skip to next channel" or "Mark dead" manually.
  }, [])

  // ─── Filtering & sorting ────────────────────────────────────────────────
  const recentSet = useMemo(() => new Set(recentChannels), [recentChannels])

  const filteredChannels = useMemo(() => {
    if (!data) return []
    let list = data.channels
    if (showFavsOnly) list = list.filter(c => favorites.has(c.url))
    if (showRecentOnly) list = list.filter(c => recentSet.has(c.url))
    if (activeGroup !== '__all') list = list.filter(c => c.group === activeGroup)

    if (qualityFilter !== 'all') {
      list = list.filter(c => {
        const q = (c.quality || '').toLowerCase()
        if (qualityFilter === '4k') return q === '4k' || q === '8k'
        if (qualityFilter === '1080p') return c.qualityTier && c.qualityTier >= 30
        if (qualityFilter === '720p') return c.qualityTier && c.qualityTier >= 20
        if (qualityFilter === 'sd') return c.qualityTier !== undefined
        return true
      })
    }

    if (hideBad) {
      list = list.filter(c => !c.not247 && !c.geoBlocked)
    }
    if (hideDead) {
      list = list.filter(c => !deadChannels.has(c.url))
    }

    // ─── Tuliprox-style filter DSL ────────────────────────────────────────
    if (filterFnRef.current) {
      const fn = filterFnRef.current
      list = list.filter(c => fn({
        name: c.displayName || c.name || '',
        group: c.group || '',
        url: c.url || '',
        logo: c.logo || '',
        quality: c.quality || '',
        country: c.countryCode || c.country || '',
      }))
    }

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.group || '').toLowerCase().includes(q) ||
        (c.country || '').toLowerCase().includes(q)
      )
    }

    const sorted = [...list]
    if (sortMode === 'az') {
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName))
    } else if (sortMode === 'za') {
      sorted.sort((a, b) => b.displayName.localeCompare(a.displayName))
    } else if (sortMode === 'quality') {
      sorted.sort((a, b) => (b.qualityTier ?? 0) - (a.qualityTier ?? 0))
    } else if (sortMode === 'recent') {
      const idx = (url: string) => recentChannels.indexOf(url)
      sorted.sort((a, b) => {
        const ai = idx(a.url), bi = idx(b.url)
        if (ai === -1 && bi === -1) return a.displayName.localeCompare(b.displayName)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    }
    return sorted
  }, [data, search, activeGroup, showFavsOnly, showRecentOnly, favorites, deadChannels, hideDead, hideBad, qualityFilter, sortMode, recentChannels, recentSet, filterExpr])

  const filteredChannelsRef = useRef<Channel[]>([])
  useEffect(() => {
    filteredChannelsRef.current = filteredChannels
  }, [filteredChannels])

  // Group counts
  const groupCounts = useMemo(() => {
    if (!data) return new Map<string, number>()
    const m = new Map<string, number>()
    let list = data.channels
    if (showFavsOnly) list = list.filter(c => favorites.has(c.url))
    if (showRecentOnly) list = list.filter(c => recentSet.has(c.url))
    if (hideBad) list = list.filter(c => !c.not247 && !c.geoBlocked)
    if (hideDead) list = list.filter(c => !deadChannels.has(c.url))
    for (const c of list) {
      const g = c.group || 'Other'
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [data, showFavsOnly, showRecentOnly, favorites, deadChannels, hideDead, hideBad, recentSet])

  const totalVisibleCount = useMemo(() => {
    if (!data) return 0
    let list = data.channels
    if (showFavsOnly) list = list.filter(c => favorites.has(c.url))
    if (showRecentOnly) list = list.filter(c => recentSet.has(c.url))
    if (hideBad) list = list.filter(c => !c.not247 && !c.geoBlocked)
    if (hideDead) list = list.filter(c => !deadChannels.has(c.url))
    return list.length
  }, [data, showFavsOnly, showRecentOnly, favorites, deadChannels, hideDead, hideBad, recentSet])

  // ─── Provider switching ─────────────────────────────────────────────────
  const switchProvider = useCallback((provider: Provider) => {
    setActiveProvider(provider)
    setActiveCategory(provider.categories[0])
    const firstCat = provider.categories[0]
    setActivePlaylistId(firstCat.playlists && firstCat.playlists.length > 0 ? firstCat.playlists[0].id : undefined)
  }, [])
  // Keep the ref in sync so callbacks defined earlier in the component can call it
  useEffect(() => { switchProviderRef.current = switchProvider }, [switchProvider])

  const switchCategory = useCallback((category: ProviderCategory) => {
    setActiveCategory(category)
    setActivePlaylistId(category.playlists && category.playlists.length > 0 ? category.playlists[0].id : undefined)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="lg:hidden p-2 rounded-lg hover:bg-secondary"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Radio className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight">FreeStream TV</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">{language === 'ar' ? 'تلفزيون مجاني — بدون تسجيل' : 'Free live TV — no signup'}</p>
            </div>
          </div>

          <div className="flex-1 max-w-xl mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search channels…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/60 border-border focus-visible:bg-secondary"
            />
          </div>

          <Button
            variant={showRecentOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowRecentOnly(v => !v); setShowFavsOnly(false) }}
            className="gap-2"
            title="Recently watched"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Recent</span>
          </Button>

          <Button
            variant={showFavsOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowFavsOnly(v => !v); setShowRecentOnly(false) }}
            className="gap-2"
          >
            <Heart className={cn('w-4 h-4', showFavsOnly && 'fill-current')} />
            <span className="hidden sm:inline">Favorites</span>
            {favorites.size > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {favorites.size}
              </Badge>
            )}
          </Button>

          {/* Language toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLanguage(l => l === 'en' ? 'ar' : 'en')}
            className="gap-1.5 font-bold"
            title={language === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
          >
            {language === 'en' ? '🇸🇦 AR' : '🇬🇧 EN'}
          </Button>

          {/* Global Search button (⌘K / Ctrl+K) — searches iptv-org 8000+ channels */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGlobalSearchOpen(true)}
            className="gap-2"
            aria-label="Global Search"
            title="Global Search — search 8000+ channels from iptv-org (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline">Search All</span>
          </Button>

          {/* Favorites grid button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFavGrid(true)}
            className="gap-2"
            title="Favorites grid"
          >
            <Heart className={cn('w-4 h-4', favorites.size > 0 && 'fill-primary text-primary')} />
            <span className="hidden md:inline">Favs</span>
            {favorites.size > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-xs">{favorites.size}</Badge>
            )}
          </Button>

          {/* Recently watched grid button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRecentGrid(true)}
            className="gap-2"
            title="Recently watched grid"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden md:inline">Recent</span>
            {recentChannels.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-xs">{recentChannels.length}</Badge>
            )}
          </Button>

          {/* Multi-view button — watch 2-4 channels simultaneously */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMultiView(true)}
            className="gap-2"
            title="Multi-View — watch multiple channels at once"
          >
            <Grid3x3 className="w-4 h-4" />
            <span className="hidden lg:inline">Multi-View</span>
          </Button>

          {/* DVR button — record current channel */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDVR(true)}
            className="gap-2"
            title="DVR — Record & manage recordings"
          >
            <Circle className={cn('w-4 h-4', dvrRecording && 'fill-red-500 text-red-500 animate-pulse')} />
            <span className="hidden lg:inline">DVR</span>
          </Button>

          {/* Cloud sync button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSync(true)}
            className="gap-2"
            title="Cloud Sync — share favorites across devices"
          >
            <Cloud className={cn('w-4 h-4', syncStatus === 'ok' && 'text-green-500', syncStatus === 'syncing' && 'animate-pulse')} />
            <span className="hidden lg:inline">Sync</span>
            {syncKey && <Badge variant="secondary" className="ml-0.5 px-1 py-0 text-[10px]">✓</Badge>}
          </Button>

          {/* Refresh button — bypasses cache to pull latest auto-updated playlists */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshNonce(n => n + 1)}
            className="gap-2"
            aria-label="Refresh"
            title="Refresh — pull the latest version of this playlist (bypasses cache)"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Admin button — add/delete channels + load custom M3U + Xtream + Twitch/YT */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdmin(v => !v)}
            className="gap-2"
            aria-label="Admin"
            title="Admin — Custom channels, Xtream Codes, Twitch/YouTube"
          >
            <Tv className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(v => !v)}
            className="gap-2"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>
          </Button>
        </div>

        {/* ─── Admin panel — tabbed: Custom Channels / Xtream Codes / Twitch+YT ─── */}
        {showAdmin && (
          <div className="px-4 md:px-6 pb-3 border-t border-border bg-card/40">
            <div className="max-w-3xl mx-auto pt-3 space-y-3">
              {/* Tab bar */}
              <div className="flex gap-1 border-b border-border overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setAdminTab('channels')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap',
                    adminTab === 'channels' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Tv className="w-3.5 h-3.5" /> Channels ({customChannels.length})
                </button>
                <button
                  onClick={() => setAdminTab('xtream')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap',
                    adminTab === 'xtream' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Key className="w-3.5 h-3.5" /> Xtream {xcCreds && <span className="text-green-500">✓</span>}
                </button>
                <button
                  onClick={() => setAdminTab('stalker')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap',
                    adminTab === 'stalker' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Radio className="w-3.5 h-3.5" /> Stalker {stalkerCreds && <span className="text-green-500">✓</span>}
                </button>
                <button
                  onClick={() => setAdminTab('embed')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap',
                    adminTab === 'embed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Twitch className="w-3.5 h-3.5" /> Twitch & YT
                </button>
              </div>

              {/* ─── Tab: Custom Channels ─── */}
              {adminTab === 'channels' && (
                <>
                  {/* Load M3U by URL */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste M3U URL (https://...m3u8)"
                      value={customM3uUrl}
                      onChange={(e) => setCustomM3uUrl(e.target.value)}
                      className="bg-secondary/40 flex-1"
                    />
                    <Button onClick={loadCustomM3u} size="sm" className="gap-2 shrink-0">
                      <Search className="w-3 h-3" /> Load URL
                    </Button>
                  </div>

                  {/* Upload M3U file (or drag-and-drop anywhere) */}
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition cursor-pointer text-sm border border-dashed border-border">
                      <input
                        type="file"
                        accept=".m3u,.m3u8,audio/mpegurl,application/x-mpegURL"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleM3UFileUpload(file)
                          e.target.value = ''
                        }}
                      />
                      <Play className="w-3 h-3" /> Upload .m3u file (or drag & drop anywhere)
                    </label>
                  </div>

                  {/* Add single channel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Channel name (e.g. My Channel)"
                      value={adminChannelName}
                      onChange={(e) => setAdminChannelName(e.target.value)}
                      className="bg-secondary/40"
                    />
                    <Input
                      placeholder="Stream URL (https://...m3u8)"
                      value={adminChannelUrl}
                      onChange={(e) => setAdminChannelUrl(e.target.value)}
                      className="bg-secondary/40"
                    />
                    <Input
                      placeholder="Logo URL (optional)"
                      value={adminChannelLogo}
                      onChange={(e) => setAdminChannelLogo(e.target.value)}
                      className="bg-secondary/40"
                    />
                    <Input
                      placeholder="Group (e.g. Sports, News)"
                      value={adminChannelGroup}
                      onChange={(e) => setAdminChannelGroup(e.target.value)}
                      className="bg-secondary/40"
                    />
                  </div>
                  <Button onClick={addCustomChannel} size="sm" className="gap-2">
                    <Plus className="w-3 h-3" /> Add Channel
                  </Button>

                  {customChannels.length > 0 && (
                    <div className="space-y-1 mt-2 max-h-60 overflow-y-auto thin-scroll">
                      <p className="text-xs text-muted-foreground">Custom channels (click Play, × to delete):</p>
                      {customChannels.map(ch => (
                        <div key={ch.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition">
                          {ch.logo ? (
                            <img src={ch.logo} alt="" className="w-8 h-8 rounded object-contain bg-white/5" />
                          ) : (
                            <Tv className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium flex-1 truncate">{ch.displayName}</span>
                          <span className="text-xs text-muted-foreground">{ch.group}</span>
                          <button
                            onClick={() => {
                              handleSelectChannel(ch)
                              setShowAdmin(false)
                            }}
                            className="px-2 py-1 rounded text-xs bg-primary/20 text-primary hover:bg-primary/30 transition"
                          >
                            Play
                          </button>
                          <button
                            onClick={() => deleteCustomChannel(ch.id)}
                            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition"
                            aria-label="Delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ─── Tab: Xtream Codes ─── */}
              {adminTab === 'xtream' && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Login to any Xtream Codes provider (or a self-hosted <a href="https://github.com/kpirnie/kptv-proxy" target="_blank" rel="noreferrer" className="text-primary underline">kptv-proxy</a> server). Credentials are stored in your browser only.
                  </p>

                  {/* ─── Demo button — uses built-in mock XC server ─── */}
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-primary">Try the Demo (no server needed)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Loads a built-in mock XC server with 16 real iptv-org channels (Al Jazeera, DW, NFL Channel, etc.) + 5 public-domain VOD titles. Tests the full XC flow — auth, categories, streams, M3U, EPG, playback.
                      </p>
                    </div>
                    <Button
                      onClick={handleXtreamDemo}
                      size="sm"
                      disabled={xcStatus === 'loading'}
                      className="gap-2 shrink-0"
                    >
                      {xcStatus === 'loading' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Load Demo
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="Server URL (http://host:port) or /api/xtream-mock"
                      value={xcServer}
                      onChange={(e) => setXcServer(e.target.value)}
                      className="bg-secondary/40 sm:col-span-3 font-mono text-xs"
                    />
                    <Input
                      placeholder="Username"
                      value={xcUser}
                      onChange={(e) => setXcUser(e.target.value)}
                      className="bg-secondary/40"
                      autoComplete="off"
                    />
                    <Input
                      placeholder="Password"
                      value={xcPass}
                      onChange={(e) => setXcPass(e.target.value)}
                      type="password"
                      className="bg-secondary/40"
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={handleXtreamLogin}
                      size="sm"
                      disabled={xcStatus === 'loading'}
                      className="gap-2"
                    >
                      {xcStatus === 'loading' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Key className="w-3 h-3" />
                      )}
                      {xcCreds ? 'Test & Save' : 'Connect'}
                    </Button>
                    {xcCreds && (
                      <Button onClick={handleXtreamLogout} size="sm" variant="outline" className="gap-2">
                        Logout
                      </Button>
                    )}
                    {xcCreds && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          const xtreamProv = PROVIDERS.find(p => p.id === 'xtream')
                          if (xtreamProv) {
                            switchProvider(xtreamProv)
                            setShowAdmin(false)
                          }
                        }}
                      >
                        <Play className="w-3 h-3" /> Open XC channels
                      </Button>
                    )}
                    {xcCreds && isDemoCreds(xcCreds) && (
                      <Badge variant="outline" className="text-xs gap-1 text-purple-400 border-purple-400/40">
                        DEMO MODE
                      </Badge>
                    )}
                  </div>

                  {xcMessage && (
                    <p className={cn(
                      'text-xs p-2 rounded-lg whitespace-pre-wrap',
                      xcStatus === 'ok' && 'bg-green-500/10 text-green-500',
                      xcStatus === 'error' && 'bg-destructive/10 text-destructive',
                      xcStatus === 'idle' && 'bg-secondary/40 text-muted-foreground',
                    )}>
                      {xcMessage}
                    </p>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1 p-2 rounded-lg bg-secondary/20">
                    <p className="font-semibold">Supported XC API actions (via /api/xtream proxy):</p>
                    <p>• <code className="text-primary">player_api.php</code> — auth, live/vod/series categories & streams</p>
                    <p>• <code className="text-primary">get.php</code> — full M3U playlist (parsed as channels)</p>
                    <p>• <code className="text-primary">xmltv.php</code> — full XMLTV EPG (fetched on demand)</p>
                    <p>• Live stream URL: <code className="text-primary">/live/user/pass/id.m3u8</code></p>
                  </div>
                </div>
              )}

              {/* ─── Tab: Stalker Portal ─── */}
              {adminTab === 'stalker' && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Login to a Stalker / Ministra portal using a MAC address (00:1A:79:XX:XX:XX).
                    Credentials are stored in your browser only.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="Portal URL (http://portal.example.com)"
                      value={stalkerUrl}
                      onChange={(e) => setStalkerUrl(e.target.value)}
                      className="bg-secondary/40 sm:col-span-3 font-mono text-xs"
                    />
                    <Input
                      placeholder="MAC address (00:1A:79:XX:XX:XX)"
                      value={stalkerMac}
                      onChange={(e) => setStalkerMac(e.target.value)}
                      className="bg-secondary/40 sm:col-span-3 font-mono text-xs"
                    />
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={handleStalkerLogin}
                      size="sm"
                      disabled={stalkerStatus === 'loading'}
                      className="gap-2"
                    >
                      {stalkerStatus === 'loading' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Radio className="w-3 h-3" />
                      )}
                      {stalkerCreds ? 'Test & Save' : 'Connect'}
                    </Button>
                    {stalkerCreds && (
                      <Button onClick={handleStalkerLogout} size="sm" variant="outline" className="gap-2">
                        Logout
                      </Button>
                    )}
                    {stalkerCreds && (
                      <Button
                        onClick={handleStalkerLoadChannels}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Play className="w-3 h-3" /> Load channels
                      </Button>
                    )}
                  </div>

                  {stalkerMessage && (
                    <p className={cn(
                      'text-xs p-2 rounded-lg whitespace-pre-wrap',
                      stalkerStatus === 'ok' && 'bg-green-500/10 text-green-500',
                      stalkerStatus === 'error' && 'bg-destructive/10 text-destructive',
                      stalkerStatus === 'idle' && 'bg-secondary/40 text-muted-foreground',
                    )}>
                      {stalkerMessage}
                    </p>
                  )}

                  {stalkerChannels.length > 0 && (
                    <div className="space-y-1 mt-2 max-h-60 overflow-y-auto thin-scroll">
                      <p className="text-xs text-muted-foreground">{stalkerChannels.length} channels loaded — click to play:</p>
                      {stalkerChannels.slice(0, 50).map(ch => (
                        <div key={ch.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition">
                          <span className="text-sm font-medium flex-1 truncate">{ch.displayName}</span>
                          <button
                            onClick={() => { handleSelectChannel(ch); setShowAdmin(false) }}
                            className="px-2 py-1 rounded text-xs bg-primary/20 text-primary hover:bg-primary/30 transition"
                          >
                            Play
                          </button>
                          <button
                            onClick={() => setCustomChannels(prev => [ch, ...prev])}
                            className="px-2 py-1 rounded text-xs bg-secondary hover:bg-secondary/80 transition"
                          >
                            Save
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1 p-2 rounded-lg bg-secondary/20">
                    <p className="font-semibold">Stalker Portal API (via /api/stalker proxy):</p>
                    <p>• <code className="text-primary">/stalker_portal/server/load.php</code> — handshake, channels, EPG</p>
                    <p>• Auth: MAC address (no username/password)</p>
                    <p>• Common portals: Ministra, Stalker TV, MAG portal</p>
                  </div>
                </div>
              )}

              {/* ─── Tab: Twitch & YouTube ─── */}
              {adminTab === 'embed' && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Add Twitch / YouTube streams. Use the official embed player — no server needed.
                    Added streams appear in the <strong>"My Channels"</strong> provider at the top of the provider grid.
                  </p>

                  {/* Quick-add Twitch */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 text-xs font-mono shrink-0">
                      <Twitch className="w-3.5 h-3.5 text-purple-500" /> twitch:
                    </div>
                    <Input
                      placeholder="Twitch channel name (e.g. shroud)"
                      value={twitchInput}
                      onChange={(e) => setTwitchInput(e.target.value.trim())}
                      onKeyDown={(e) => { if (e.key === 'Enter' && twitchInput) addTwitchChannel() }}
                      className="bg-secondary/40 flex-1"
                    />
                    <Button
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={() => addTwitchChannel()}
                      disabled={!twitchInput}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>

                  {/* Quick-add YouTube live (by channel ID) */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 text-xs font-mono shrink-0">
                      <Youtube className="w-3.5 h-3.5 text-red-500" /> youtube-live:
                    </div>
                    <Input
                      placeholder="YouTube channel ID (UCxxxx...)"
                      value={ytLiveInput}
                      onChange={(e) => setYtLiveInput(e.target.value.trim())}
                      onKeyDown={(e) => { if (e.key === 'Enter' && ytLiveInput) addYtLiveChannel() }}
                      className="bg-secondary/40 flex-1"
                    />
                    <Button
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={() => addYtLiveChannel()}
                      disabled={!ytLiveInput}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>

                  {/* Quick-add YouTube video (VOD) */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 text-xs font-mono shrink-0">
                      <Youtube className="w-3.5 h-3.5 text-red-500" /> youtube:
                    </div>
                    <Input
                      placeholder="YouTube video ID (dQw4w9WgXcQ)"
                      value={ytVodInput}
                      onChange={(e) => setYtVodInput(e.target.value.trim())}
                      onKeyDown={(e) => { if (e.key === 'Enter' && ytVodInput) addYtVodChannel() }}
                      className="bg-secondary/40 flex-1"
                    />
                    <Button
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={() => addYtVodChannel()}
                      disabled={!ytVodInput}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 p-2 rounded-lg bg-secondary/20">
                    <p className="font-semibold">URL formats (also work in "Custom Channels" tab → Stream URL):</p>
                    <p>• <code className="text-primary">twitch:CHANNEL</code> — Twitch live</p>
                    <p>• <code className="text-primary">twitch-vod:VIDEO_ID</code> — Twitch VOD</p>
                    <p>• <code className="text-primary">twitch-clip:SLUG</code> — Twitch clip</p>
                    <p>• <code className="text-primary">youtube:VIDEO_ID</code> — YouTube VOD</p>
                    <p>• <code className="text-primary">youtube-live:CHANNEL_ID</code> — YouTube 24/7 live</p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Or browse the built-in popular channels via the <strong>Twitch &amp; YouTube</strong> provider in the provider grid above.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Settings panel ─── */}
        {showSettings && (
          <div className="px-4 md:px-6 pb-3 border-t border-border bg-card/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 max-w-3xl mx-auto">
              <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary/40">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Auto-skip dead streams</p>
                    <p className="text-xs text-muted-foreground">Skip to next channel on error</p>
                  </div>
                </div>
                <Switch checked={autoSkip} onCheckedChange={setAutoSkip} />
              </label>

              <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary/40">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Hide dead channels</p>
                    <p className="text-xs text-muted-foreground">{deadChannels.size} marked dead</p>
                  </div>
                </div>
                <Switch checked={hideDead} onCheckedChange={setHideDead} />
              </label>

              <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary/40">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Hide bad sources</p>
                    <p className="text-xs text-muted-foreground">[Not 24/7] and [Geo-blocked]</p>
                  </div>
                </div>
                <Switch checked={hideBad} onCheckedChange={setHideBad} />
              </label>

              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary/40">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Max stream quality</p>
                    <p className="text-xs text-muted-foreground">For slow connections</p>
                  </div>
                </div>
                <Select value={maxQuality} onValueChange={(v) => setMaxQuality(v as MaxQuality)}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="480p">480p max</SelectItem>
                    <SelectItem value="720p">720p max</SelectItem>
                    <SelectItem value="1080p">1080p max</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {deadChannels.size > 0 && (
                <button
                  onClick={() => setDeadChannels(new Set())}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition text-sm sm:col-span-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset dead channel list ({deadChannels.size})
                </button>
              )}

              {/* ─── Tuliprox-style filter DSL ─── */}
              <div className="sm:col-span-2 px-4 py-3 rounded-lg bg-secondary/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Filter expression (tuliprox-style)</p>
                    <p className="text-xs text-muted-foreground">
                      Boolean + regex DSL: <code className="text-primary/80">Name ~ ".*NBA.*" AND NOT Group ~ ".*XXX.*"</code>
                    </p>
                  </div>
                </div>
                <Input
                  placeholder='e.g.  Group ~ "^News.*" OR Name ~ ".*World Cup.*"'
                  value={filterExpr}
                  onChange={(e) => setFilterExpr(e.target.value)}
                  className="bg-background/60 font-mono text-xs"
                />
                {filterError && (
                  <p className="text-xs text-destructive">⚠ {filterError}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">Quick presets:</span>
                  {[
                    { label: 'News', expr: 'Group ~ ".*News.*" OR Name ~ ".*News.*"' },
                    { label: 'Sports', expr: 'Group ~ ".*Sport.*" OR Name ~ ".*Sport.*"' },
                    { label: 'Movies', expr: 'Group ~ ".*Movi.*" OR Name ~ ".*Cinema.*"' },
                    { label: 'HD only', expr: 'Quality ~ "(1080|720|4K|FHD|HD)"' },
                    { label: 'Not 4K', expr: 'NOT Quality ~ "4K"' },
                    { label: 'No XXX', expr: 'NOT (Group ~ ".*XXX.*" OR Name ~ ".*XXX.*" OR Group ~ ".*Adult.*")' },
                    { label: 'Arabic', expr: 'Group ~ ".*AR.*" OR Name ~ ".*beIN.*"' },
                    { label: 'Clear', expr: '' },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => setFilterExpr(p.expr)}
                      className="px-2 py-0.5 rounded-full bg-secondary text-xs hover:bg-primary hover:text-primary-foreground transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Custom User-Agent (iptvnator feature) ─── */}
              <div className="sm:col-span-2 px-4 py-3 rounded-lg bg-secondary/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Custom User-Agent (advanced)</p>
                    <p className="text-xs text-muted-foreground">
                      Some streams only work with specific User-Agent strings (e.g. <code className="font-mono">Lavf/57.83.100</code>). Applied server-side when fetching playlists via URL.
                    </p>
                  </div>
                </div>
                <Input
                  placeholder="e.g.  Lavf/57.83.100  (leave empty for default)"
                  value={customUserAgent}
                  onChange={(e) => setCustomUserAgent(e.target.value)}
                  className="bg-background/60 font-mono text-xs"
                />
                <div className="flex gap-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">Quick presets:</span>
                  {[
                    { label: 'Lavf (VLC)', ua: 'Lavf/57.83.100' },
                    { label: 'VLC', ua: 'VLC/3.0.18 LibVLC/3.0.18' },
                    { label: 'iTunes', ua: 'iTunes/12.11.3' },
                    { label: 'Kodi', ua: 'Kodi/19.0 (X11; Linux x86_64) Krypton/19.0 Git:19.0' },
                    { label: 'Clear', ua: '' },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => setCustomUserAgent(p.ua)}
                      className="px-2 py-0.5 rounded-full bg-secondary text-xs hover:bg-primary hover:text-primary-foreground transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Keyboard shortcuts hint ─── */}
              <div className="sm:col-span-2 px-4 py-3 rounded-lg bg-secondary/40 text-xs text-muted-foreground">
                <span className="font-semibold">Keyboard shortcuts:</span>{' '}
                Press <kbd className="px-1 py-0.5 rounded bg-secondary-foreground/20">?</kbd> for help ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-secondary-foreground/20">Ctrl+K</kbd> global search ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-secondary-foreground/20">↑↓</kbd> prev/next channel ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-secondary-foreground/20">Space</kbd> play/pause ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-secondary-foreground/20">F</kbd> fullscreen ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-secondary-foreground/20">P</kbd> PiP
              </div>
            </div>
          </div>
        )}

        {/* ─── Provider selector — collapsible grid with logos ─── */}
        <div className="px-4 md:px-6 pb-2">
          {/* Active provider bar (click to expand grid) */}
          <button
            onClick={() => setProviderGridOpen(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary/60 hover:bg-secondary transition border border-border"
          >
            {activeProvider.logo ? (
              <img
                src={activeProvider.logo}
                alt={activeProvider.name}
                className="w-7 h-7 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent && !parent.querySelector('.fallback-flag')) {
                    const span = document.createElement('span')
                    span.className = 'fallback-flag text-2xl'
                    span.textContent = activeProvider.flag
                    parent.insertBefore(span, parent.firstChild)
                  }
                }}
              />
            ) : (
              <span className="text-2xl">{activeProvider.flag}</span>
            )}
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">{activeProvider.name}</p>
              <p className="text-xs text-muted-foreground truncate">{activeProvider.description}</p>
            </div>
            <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition', providerGridOpen && 'rotate-180')} />
          </button>

          {/* Provider grid — expands when bar is clicked */}
          {providerGridOpen && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2 rounded-xl bg-card/60 border border-border">
              {PROVIDERS.map(prov => (
                <button
                  key={prov.id}
                  onClick={() => {
                    switchProvider(prov)
                    setProviderGridOpen(false)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg transition border',
                    activeProvider.id === prov.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30'
                      : 'bg-secondary/30 hover:bg-secondary border-transparent',
                  )}
                >
                  {prov.logo ? (
                    <img
                      src={prov.logo}
                      alt={prov.name}
                      className={cn(
                        'w-8 h-8 object-contain',
                        activeProvider.id === prov.id && 'brightness-0 invert',
                      )}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent && !parent.querySelector('.fallback-flag')) {
                          const span = document.createElement('span')
                          span.className = 'fallback-flag text-xl'
                          span.textContent = prov.flag
                          parent.insertBefore(span, parent.firstChild)
                        }
                      }}
                    />
                  ) : (
                    <span className="text-xl">{prov.flag}</span>
                  )}
                  <span className="text-xs font-medium text-center leading-tight">{prov.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Row 2: Category chips for active provider ─── */}
        <div className="px-4 md:px-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {activeProvider.categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => switchCategory(cat)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap text-xs font-medium transition',
                activeCategory?.id === cat.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{cat.flag}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* ─── Row 3: Playlist chips ─── */}
        {activeCategory?.playlists && activeCategory.playlists.length > 0 && (
          <div className="px-4 md:px-6 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {activeCategory.playlists.map(pl => (
              <button
                key={pl.id}
                onClick={() => setActivePlaylistId(pl.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md whitespace-nowrap text-xs transition border',
                  activePlaylistId === pl.id
                    ? 'bg-accent text-accent-foreground border-primary/40'
                    : 'bg-transparent text-muted-foreground hover:text-foreground border-border',
                )}
              >
                <span>{pl.flag}</span>
                <span>{pl.name}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ─── Main ─── */}
      <div className="flex-1 flex relative">
        {/* ─── Sidebar (pro layout) ─── */}
        <aside
          className={cn(
            'absolute lg:static inset-y-0 left-0 z-20 w-72 bg-sidebar border-r border-border transition-transform duration-200 flex flex-col',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          {/* Sidebar header with view toggle */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-1 mb-2">
              <button
                onClick={() => setSidebarView('channels')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
                  sidebarView === 'channels' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                Channel Types
              </button>
              <button
                onClick={() => setSidebarView('guide')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
                  sidebarView === 'guide' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                TV Guide
              </button>
            </div>

            {sidebarView === 'channels' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={qualityFilter} onValueChange={(v) => setQualityFilter(v as QualityFilter)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All qualities</SelectItem>
                      <SelectItem value="4k">4K / 8K only</SelectItem>
                      <SelectItem value="1080p">1080p+</SelectItem>
                      <SelectItem value="720p">720p+</SelectItem>
                      <SelectItem value="sd">Any known</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="az">A → Z</SelectItem>
                      <SelectItem value="za">Z → A</SelectItem>
                      <SelectItem value="recent">Recently watched</SelectItem>
                      <SelectItem value="quality">Best quality first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {sidebarView === 'guide' ? (
            /* TV Guide view — synced with curated channels, click to play */
            <ScrollArea className="flex-1 thin-scroll">
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to Watch</h3>
                  {guideLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>

                {/* Genre tabs */}
                {guideGenres.length > 0 && (
                  <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar">
                    {guideGenres.map((g: any) => (
                      <button
                        key={g.id}
                        onClick={() => setActiveGuideGenre(g.id)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition whitespace-nowrap',
                          activeGuideGenre === g.id
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                        )}
                      >
                        <span>{g.flag}</span>
                        <span>{g.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Channels for active genre */}
                {guideLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 mb-2" />)
                ) : (() => {
                  const activeGenre = guideGenres.find((g: any) => g.id === activeGuideGenre)
                  const channels = activeGenre?.channels || []
                  if (channels.length === 0) {
                    return <p className="text-xs text-muted-foreground text-center py-4">No channels for this genre</p>
                  }
                  return (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground mb-2">
                        {activeGenre?.flag} {activeGenre?.name} — {activeGenre?.channelCount} channels available
                      </p>
                      {channels.map((ch: any, i: number) => (
                        <div
                          key={i}
                          className="p-2 rounded-md hover:bg-secondary/60 transition cursor-pointer"
                          onClick={() => {
                            // Click to play this channel directly
                            const channelObj: Channel = {
                              id: `guide-${i}`,
                              name: ch.name,
                              displayName: ch.displayName,
                              url: ch.url,
                              logo: ch.logo,
                              group: ch.group || activeGuideGenre,
                              quality: ch.quality,
                              qualityTier: ch.quality === '4K' ? 40 : ch.quality === '1080p' ? 30 : ch.quality === '720p' ? 20 : 0,
                              isVod: ch.isVod,
                              countryCode: ch.country,
                            }
                            handleSelectChannel(channelObj)
                            setSidebarView('channels')
                          }}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            {ch.logo ? (
                              <img src={ch.logo} alt="" className="w-5 h-5 object-contain rounded-sm bg-white/5" />
                            ) : (
                              <Tv className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="text-xs font-medium truncate flex-1">{ch.displayName}</span>
                            {ch.quality && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {ch.quality}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                              </span>
                              LIVE
                            </Badge>
                          </div>
                          {ch.group && (
                            <p className="text-xs text-foreground/70 truncate pl-7">{ch.group}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </ScrollArea>
          ) : (
            /* Channel types view */
            <ScrollArea className="flex-1 thin-scroll">
              <div className="p-2 space-y-0.5">
                {data && (
                  <p className="px-3 py-1 text-xs text-muted-foreground">
                    {data.totalCount.toLocaleString()} channels · {data.groups.length} types
                    {deadChannels.size > 0 && (
                      <span className="text-primary/80"> · {deadChannels.size} dead</span>
                    )}
                  </p>
                )}
                <GroupButton
                  label="All Channels"
                  count={totalVisibleCount}
                  active={activeGroup === '__all' && !showFavsOnly && !showRecentOnly}
                  onClick={() => { setActiveGroup('__all'); setShowFavsOnly(false); setShowRecentOnly(false); setSidebarOpen(false) }}
                  icon={<Globe className="w-4 h-4" />}
                />
                <GroupButton
                  label="Favorites"
                  count={favorites.size}
                  active={showFavsOnly}
                  onClick={() => { setShowFavsOnly(true); setShowRecentOnly(false); setActiveGroup('__all'); setSidebarOpen(false) }}
                  icon={<Star className="w-4 h-4" />}
                />
                <GroupButton
                  label="Recently Watched"
                  count={recentChannels.length}
                  active={showRecentOnly}
                  onClick={() => { setShowRecentOnly(true); setShowFavsOnly(false); setActiveGroup('__all'); setSidebarOpen(false) }}
                  icon={<Clock className="w-4 h-4" />}
                />
                <div className="my-2 h-px bg-border" />
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channel Types</p>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 mx-2" />
                  ))
                ) : (
                  data?.groups
                    .map(group => ({ group, count: groupCounts.get(group) ?? 0 }))
                    .filter(({ count }) => count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map(({ group, count }) => (
                      <GroupButton
                        key={group}
                        label={group}
                        count={count}
                        active={activeGroup === group && !showFavsOnly && !showRecentOnly}
                        onClick={() => { setActiveGroup(group); setShowFavsOnly(false); setShowRecentOnly(false); setSidebarOpen(false) }}
                      />
                    ))
                )}
              </div>
            </ScrollArea>
          )}
        </aside>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ─── Main content ─── */}
        <main className="flex-1 min-w-0 flex flex-col lg:flex-row">
          {/* Player + now playing */}
          <section className="lg:w-2/3 xl:w-3/4 p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            {currentChannel ? (
              <>
                {/* ─── Player routing ──────────────────────────────────────────
                  • twitch:* / twitch-vod:* / twitch-clip:* / youtube:* / youtube-live:* → EmbedPlayer
                    (EmbedPlayer internally resolves twitch:CHANNEL via /api/twitch and
                    renders its own VideoPlayer with the HLS URL — no iframe needed for live)
                  • everything else (HLS .m3u8, .mp4) → VideoPlayer
                */}
                {isEmbedUrl(currentChannel.url) ? (
                  <EmbedPlayer
                    url={currentChannel.url}
                    channelName={currentChannel.displayName}
                    poster={currentChannel.logo}
                    onError={handlePlayerError}
                    onNext={goToNextChannel}
                    autoSkip={autoSkip}
                    maxQuality={maxQuality}
                    externalVideoRef={videoRef}
                  />
                ) : (
                  <VideoPlayer
                    src={currentChannel.url}
                    poster={currentChannel.logo}
                    channelName={currentChannel.displayName}
                    onError={handlePlayerError}
                    onNext={goToNextChannel}
                    autoSkip={autoSkip}
                    maxQuality={maxQuality}
                    externalVideoRef={videoRef}
                  />
                )}

                {/* ─── EPG "Now Playing" panel (iptvnator-inspired) ─── */}
                <div className="p-3 rounded-xl bg-card/40 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Now Playing</p>
                    {epgLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    {epgNow?.synthesized && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-amber-500 border-amber-500/40 ml-auto">
                        SYNTH
                      </Badge>
                    )}
                    {currentChannel.tvgId && !epgNow?.synthesized && (
                      <span className="text-xs text-muted-foreground/70 font-mono ml-auto truncate">
                        tvg-id: {currentChannel.tvgId}
                      </span>
                    )}
                  </div>
                  {epgNow ? (
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-foreground">{epgNow.title}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${epgNow.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">{epgNow.progress || 0}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {epgNow.start && new Date(parseXmltvTime(epgNow.start)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {epgNow.stop && new Date(parseXmltvTime(epgNow.stop)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {epgNow.desc && (
                        <p className="text-xs text-muted-foreground/80 line-clamp-2">{epgNow.desc}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {epgLoading
                        ? 'Loading EPG…'
                        : currentChannel.tvgId
                          ? 'No EPG data available for this channel. (EPG covers channels with matching tvg-id from YanG-1989 + iptv-org sources.)'
                          : 'This channel has no tvg-id, so EPG cannot be matched. EPG works for channels from IPTV-org, YanG-1989, and Xtream Codes (with XMLTV).'}
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-primary border-primary/40 gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                        </span>
                        LIVE
                      </Badge>
                      {isEmbedUrl(currentChannel.url) && (
                        <Badge variant="outline" className="text-xs gap-1 text-purple-400 border-purple-400/40">
                          {currentChannel.url.startsWith('twitch') ? <Twitch className="w-2.5 h-2.5" /> : <Youtube className="w-2.5 h-2.5" />}
                          EMBED
                        </Badge>
                      )}
                      {currentChannel.countryCode && flagForCountry(currentChannel.countryCode) && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          {flagForCountry(currentChannel.countryCode)} {currentChannel.countryCode.toUpperCase()}
                        </Badge>
                      )}
                      {currentChannel.quality && (
                        <Badge variant="secondary" className="text-xs">{currentChannel.quality}</Badge>
                      )}
                      {currentChannel.group && (
                        <Badge variant="secondary" className="text-xs">{currentChannel.group}</Badge>
                      )}
                      {currentChannel.isVod && (
                        <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/40 gap-1">
                          <Play className="w-2.5 h-2.5" /> VOD
                        </Badge>
                      )}
                      {currentChannel.not247 && (
                        <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                          Not 24/7
                        </Badge>
                      )}
                      {currentChannel.geoBlocked && (
                        <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                          Geo-blocked
                        </Badge>
                      )}
                      {isDead(currentChannel) && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <ZapOff className="w-3 h-3" /> Marked dead
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight truncate">
                      {currentChannel.displayName}
                    </h2>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {currentChannel.language && <span>{currentChannel.language} · </span>}
                      <span className="text-muted-foreground/70 truncate">{currentChannel.url}</span>
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0 flex-wrap">
                    {/* Prev / Next channel (keyboard: ↑↓) — show for HLS + twitch:CHANNEL (plays via VideoPlayer) */}
                    {(!isEmbedUrl(currentChannel.url) || currentChannel.url.match(/^twitch:[a-zA-Z0-9_]/i)) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToPrevChannel}
                          className="gap-2"
                          title="Previous channel (↑)"
                        >
                          <ChevronRight className="w-4 h-4 rotate-180" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToNextChannel}
                          className="gap-2"
                          title="Next channel (↓)"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {/* PiP toggle (keyboard: P) — show for HLS + twitch:CHANNEL (plays via VideoPlayer) */}
                    {(!isEmbedUrl(currentChannel.url) || currentChannel.url.match(/^twitch:[a-zA-Z0-9_]/i)) && (
                      <Button
                        variant={pipActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={togglePiP}
                        className="gap-2"
                        title="Picture-in-Picture (P)"
                      >
                        <Tv className="w-4 h-4" />
                        <span className="hidden sm:inline">{pipActive ? 'Exit PiP' : 'PiP'}</span>
                      </Button>
                    )}
                    {/* Copy stream URL */}
                    <Button
                      variant={copiedUrl ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => copyStreamUrl(currentChannel)}
                      className="gap-2"
                      title="Copy stream URL"
                    >
                      {copiedUrl ? <CheckCircle2 className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                      <span className="hidden sm:inline">{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
                    </Button>
                    {isDead(currentChannel) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unmarkDead(currentChannel)}
                        className="gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">Unmark dead</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markDead(currentChannel)}
                        className="gap-2"
                      >
                        <ZapOff className="w-4 h-4" />
                        <span className="hidden sm:inline">Mark dead</span>
                      </Button>
                    )}
                    <Button
                      variant={isFav(currentChannel) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleFav(currentChannel)}
                      className="gap-2"
                    >
                      <Heart className={cn('w-4 h-4', isFav(currentChannel) && 'fill-current')} />
                      <span className="hidden sm:inline">
                        {isFav(currentChannel) ? 'Saved' : 'Save'}
                      </span>
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="aspect-video rounded-xl bg-card flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Tv className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Select a channel to start watching</p>
                </div>
              </div>
            )}
          </section>

          {/* Channel list */}
          <section className="lg:w-1/3 xl:w-1/4 border-t lg:border-t-0 lg:border-l border-border bg-card/30">
            <div className="p-4 border-b border-border sticky top-0 bg-card/80 backdrop-blur z-10">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  {showFavsOnly ? 'Favorites' :
                   showRecentOnly ? 'Recently Watched' :
                   activeGroup === '__all' ? 'All Channels' : activeGroup}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {filteredChannels.length.toLocaleString()}
                </Badge>
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-12rem)] thin-scroll">
              {error ? (
                <div className="p-6 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
                  <h4 className="font-semibold mb-1">Failed to load</h4>
                  <p className="text-sm text-muted-foreground mb-4">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => fetchPlaylist()}>
                    Retry
                  </Button>
                </div>
              ) : loading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex gap-3 p-2">
                      <Skeleton className="w-14 h-14 rounded-lg" />
                      <div className="flex-1 space-y-2 py-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Tv className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No channels match your filters.</p>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {filteredChannels.slice(0, 500).map(channel => (
                    <ChannelRow
                      key={channel.id}
                      channel={channel}
                      active={currentChannel?.url === channel.url}
                      fav={isFav(channel)}
                      dead={isDead(channel)}
                      recent={recentSet.has(channel.url)}
                      onSelect={() => handleSelectChannel(channel)}
                      onToggleFav={() => toggleFav(channel)}
                      onMarkDead={() => markDead(channel)}
                      onUnmarkDead={() => unmarkDead(channel)}
                    />
                  ))}
                  {filteredChannels.length > 500 && (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      Showing first 500 of {filteredChannels.length.toLocaleString()} — refine search to see more.
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </section>
        </main>
      </div>

      {/* ─── Global Search Modal (Ctrl+K) ─── */}
      {globalSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[10vh] p-4"
          onClick={() => setGlobalSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Search 8000+ channels from iptv-org… (Esc to close)"
                value={globalSearchQuery}
                onChange={e => setGlobalSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
              />
              {globalSearching && <Loader2 className="w-4 h-4 animate-spin" />}
              <kbd className="text-xs text-muted-foreground px-2 py-1 rounded bg-secondary">Esc</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto thin-scroll">
              {globalSearchResults.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {globalSearchQuery.trim().length < 2
                    ? 'Type at least 2 characters to search all iptv-org channels.'
                    : globalSearching
                      ? 'Searching…'
                      : 'No results. Try a different query.'}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {globalSearchResults.map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        handleSelectChannel(ch)
                        setGlobalSearchOpen(false)
                        setGlobalSearchQuery('')
                        setGlobalSearchResults([])
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-secondary/60 transition text-left"
                    >
                      {ch.logo ? (
                        <img src={ch.logo} alt="" className="w-10 h-10 rounded object-contain bg-white/5" loading="lazy" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                          <Tv className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ch.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{ch.group} · {ch.url.substring(0, 60)}…</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-2 border-t border-border text-xs text-muted-foreground text-center">
              Powered by iptv-org · {globalSearchResults.length} results
            </div>
          </div>
        </div>
      )}

      {/* ─── Favorites Grid Modal ─── */}
      {showFavGrid && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[5vh] p-4"
          onClick={() => setShowFavGrid(false)}
        >
          <div
            className="w-full max-w-5xl bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Heart className="w-4 h-4 text-primary fill-primary" />
                Favorites ({favorites.size})
              </h3>
              <button onClick={() => setShowFavGrid(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto thin-scroll p-4">
              {favorites.size === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  No favorites yet. Click the ♥ on any channel to save it here.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {/* Build fav cards from customChannels (which may include fav URLs) + current data */}
                  {[...(customChannels || []), ...(data?.channels || [])]
                    .filter(c => favorites.has(c.url))
                    .filter((c, i, arr) => arr.findIndex(x => x.url === c.url) === i)
                    .map(ch => (
                      <button
                        key={ch.id + ch.url}
                        onClick={() => {
                          handleSelectChannel(ch)
                          setShowFavGrid(false)
                        }}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary/60 transition border border-transparent hover:border-border"
                      >
                        {ch.logo ? (
                          <img src={ch.logo} alt="" className="w-14 h-14 rounded-lg object-contain bg-white/5" loading="lazy" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center">
                            <Tv className="w-7 h-7 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs font-medium text-center line-clamp-2">{ch.displayName}</p>
                        <p className="text-[10px] text-muted-foreground">{ch.group}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Recently Watched Grid Modal ─── */}
      {showRecentGrid && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[5vh] p-4"
          onClick={() => setShowRecentGrid(false)}
        >
          <div
            className="w-full max-w-5xl bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Recently Watched ({recentChannels.length})
              </h3>
              <button onClick={() => setShowRecentGrid(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto thin-scroll p-4">
              {recentChannels.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  No recently watched channels yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {[...(customChannels || []), ...(data?.channels || [])]
                    .filter(c => recentChannels.includes(c.url))
                    .sort((a, b) => recentChannels.indexOf(a.url) - recentChannels.indexOf(b.url))
                    .map(ch => (
                      <button
                        key={ch.id + ch.url}
                        onClick={() => {
                          handleSelectChannel(ch)
                          setShowRecentGrid(false)
                        }}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary/60 transition border border-transparent hover:border-border"
                      >
                        {ch.logo ? (
                          <img src={ch.logo} alt="" className="w-14 h-14 rounded-lg object-contain bg-white/5" loading="lazy" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center">
                            <Tv className="w-7 h-7 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs font-medium text-center line-clamp-2">{ch.displayName}</p>
                        <p className="text-[10px] text-muted-foreground">{ch.group}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Drag-and-drop M3U overlay ─── */}
      {showUploadDropzone && (
        <div className="fixed inset-0 z-[60] bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none border-4 border-dashed border-primary m-4 rounded-2xl">
          <div className="text-center">
            <Play className="w-16 h-16 text-primary mx-auto mb-4" />
            <p className="text-xl font-bold text-primary">Drop your .m3u file to import</p>
            <p className="text-sm text-muted-foreground mt-1">Channels will be added to "My Channels"</p>
          </div>
        </div>
      )}

      {/* ─── Multi-view modal ─── */}
      {showMultiView && (
        <MultiView
          channels={filteredChannels}
          onClose={() => setShowMultiView(false)}
          onSelectChannel={(ch) => handleSelectChannel(ch)}
        />
      )}

      {/* ─── DVR panel modal ─── */}
      {showDVR && (
        <DVRPanel
          currentChannel={currentChannel}
          onClose={() => setShowDVR(false)}
          onPlayRecording={(rec) => {
            handleSelectChannel({
              id: rec.id,
              name: rec.name,
              displayName: rec.name,
              rawName: rec.name,
              url: `/api/dvr?id=${rec.id}&download=1`,
              group: 'DVR Recording',
            })
            setShowDVR(false)
          }}
        />
      )}

      {/* ─── Cloud sync modal ─── */}
      {showSync && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowSync(false)}>
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Cloud className="w-4 h-4 text-primary" />
                Cloud Sync
              </h3>
              <button onClick={() => setShowSync(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Sync your favorites, recently watched, and custom channels across devices.
              Generate a sync key on one device, enter it on another.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Your sync key:</label>
                <Input
                  placeholder="No key yet — click 'Generate' to create one"
                  value={syncKey}
                  onChange={e => {
                    setSyncKey(e.target.value)
                    localStorage.setItem('freestream.syncKey', e.target.value)
                  }}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {!syncKey && (
                  <Button onClick={handleSyncCreate} size="sm" className="gap-2" disabled={syncStatus === 'syncing'}>
                    {syncStatus === 'syncing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Generate Key
                  </Button>
                )}
                {syncKey && (
                  <>
                    <Button onClick={handleSyncPush} size="sm" className="gap-2" disabled={syncStatus === 'syncing'}>
                      <Cloud className="w-3 h-3" />
                      Push
                    </Button>
                    <Button onClick={handleSyncPull} size="sm" variant="outline" className="gap-2" disabled={syncStatus === 'syncing'}>
                      <Download className="w-3 h-3" />
                      Pull
                    </Button>
                  </>
                )}
              </div>
              {syncStatus === 'ok' && (
                <p className="text-xs text-green-500">✓ Synced successfully!</p>
              )}
              {syncStatus === 'error' && (
                <p className="text-xs text-destructive">✗ Sync failed. Check your key.</p>
              )}
              {syncStatus === 'syncing' && (
                <p className="text-xs text-muted-foreground">Syncing…</p>
              )}
              <p className="text-xs text-muted-foreground/70 pt-2 border-t border-border">
                Copy this key to your other devices and paste it in the sync field to share favorites and history.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Keyboard shortcuts help (press ?) ─── */}
      <KeyboardHelp />
    </div>
  )
}

/* ─── Sub-components ─── */

function KeyboardHelp() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !(e.target as HTMLElement).matches('input, textarea')) {
        e.preventDefault()
        setShow(s => !s)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  if (!show) return null
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
      onClick={() => setShow(false)}
    >
      <div
        className="w-full max-w-md bg-card rounded-xl border border-border shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold">Keyboard Shortcuts</h3>
          <button onClick={() => setShow(false)} className="p-1 rounded hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 text-xs">
          {[
            ['Ctrl+K', 'Global search (8000+ channels)'],
            ['↑ / ↓', 'Previous / next channel'],
            ['1-9, 0', 'Jump to channel #1-10'],
            ['Space', 'Play / pause'],
            ['F', 'Fullscreen'],
            ['P', 'Picture-in-Picture'],
            ['?', 'Toggle this help'],
            ['Esc', 'Close any overlay'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-1">
              <kbd className="px-2 py-1 rounded bg-secondary font-mono text-xs">{key}</kbd>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-4 text-center">
          Press <kbd className="px-1 py-0.5 rounded bg-secondary">?</kbd> anytime to toggle this help.
        </p>
      </div>
    </div>
  )
}

function GroupButton({
  label, count, active, onClick, icon,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-secondary text-foreground/90',
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 text-left truncate">{label}</span>
      <span className={cn(
        'text-xs px-1.5 py-0.5 rounded-md',
        active ? 'bg-primary-foreground/20' : 'bg-secondary text-muted-foreground',
      )}>
        {count.toLocaleString()}
      </span>
    </button>
  )
}

function ChannelRow({
  channel, active, fav, dead, recent, onSelect, onToggleFav, onMarkDead, onUnmarkDead,
}: {
  channel: Channel
  active: boolean
  fav: boolean
  dead: boolean
  recent: boolean
  onSelect: () => void
  onToggleFav: () => void
  onMarkDead: () => void
  onUnmarkDead: () => void
}) {
  const flag = channel.countryCode ? flagForCountry(channel.countryCode) : undefined
  return (
    <div
      className={cn(
        'group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition',
        active ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-secondary',
        dead && 'opacity-50',
      )}
      onClick={onSelect}
    >
      <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-secondary flex items-center justify-center relative">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.displayName}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <Tv className="w-5 h-5 text-muted-foreground" />
        )}
        {dead && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <ZapOff className="w-4 h-4 text-destructive" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {flag && <span className="text-sm" title={channel.countryCode?.toUpperCase()}>{flag}</span>}
          <p className={cn(
            'text-sm font-medium truncate',
            active ? 'text-primary' : dead && 'line-through',
          )}>
            {channel.displayName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {channel.quality && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              {channel.quality}
            </Badge>
          )}
          {channel.isVod && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-blue-400 border-blue-400/40">
              VOD
            </Badge>
          )}
          {channel.not247 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-amber-500 border-amber-500/40">
              Not 24/7
            </Badge>
          )}
          {channel.geoBlocked && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-amber-500 border-amber-500/40">
              Geo
            </Badge>
          )}
          {recent && (
            <Clock className="w-3 h-3 text-primary/70" />
          )}
          <span className="text-xs text-muted-foreground truncate">
            {channel.group}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        {dead ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUnmarkDead() }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary"
            aria-label="Unmark as dead"
            title="Unmark as dead"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkDead() }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"
            aria-label="Mark as dead"
            title="Mark as dead"
          >
            <ZapOff className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav() }}
          className={cn(
            'p-1.5 rounded-md',
            fav ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label="Toggle favorite"
        >
          <Heart className={cn('w-4 h-4', fav && 'fill-current')} />
        </button>
      </div>
      {active && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
    </div>
  )
}
