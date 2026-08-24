'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Search, Heart, Tv, Loader2, AlertCircle, Menu, X, Radio,
  Globe, ChevronRight, Star, Zap, Filter, ZapOff, EyeOff,
  Settings, RotateCcw, Clock, Flame, Play, ChevronDown, RefreshCw, Key,
  Code, Twitch, Youtube, Plus, Circle, Grid3x3, Cloud, Download, Smartphone,
  Home as HomeIcon, ChevronLeft, Maximize2, Share2, ArrowUpDown, LayoutGrid, List,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { VideoPlayer } from '@/components/video-player'
import { EmbedPlayer, isEmbedUrl } from '@/components/embed-player'
import { MultiView } from '@/components/multiview'
import { DVRPanel } from '@/components/dvr-panel'
import { ChannelCard } from '@/components/channel-card'
import { ContentRail } from '@/components/content-rail'
import { EmptyState, LoadingState, SkeletonRail } from '@/components/states'
import { PROVIDERS, type Provider, type ProviderCategory, type ProviderTier, getProvidersByTier, getFeaturedProviders } from '@/lib/playlists'
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

type View = 'home' | 'live' | 'guide'
type ListViewMode = 'grid' | 'list'

// ═══ Helper: parse XMLTV time ═══
function parseXmltvTime(s: string): number {
  if (!s) return 0
  const m = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
  if (!m) return 0
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).getTime()
}

// ═══ Synthesized EPG ═══
const SYNTH_PROGRAMS: Record<string, string[]> = {
  sports: ['Live Match Coverage', 'SportsCenter', 'Match Highlights', 'Live: Premier League', 'Live: La Liga', 'Sports News', 'Transfer Talk'],
  news: ['World News', 'Breaking News', 'News Bulletin', 'Business Report', 'Weather Forecast', 'Top Stories'],
  movies: ['Feature Presentation', 'Movie Marathon', 'Blockbuster Hits', 'Classic Cinema', 'Now Showing'],
  music: ['Top 40 Countdown', 'Music Videos', 'Live Sessions', 'Artist Spotlight', 'Hit Parade'],
  kids: ['Cartoon Time', 'Kids Club', 'Animated Adventures', 'Educational Fun'],
  entertainment: ['Talk Show', 'Game Show', 'Reality TV', 'Comedy Special', 'Late Night Talk'],
  documentary: ['Nature Documentary', 'History Channel', 'Science Documentary', 'Wildlife', 'Planet Earth'],
  general: ['Live Broadcast', 'Current Program', 'Featured Content', 'Prime Time'],
}

function synthesizeNowPlaying(channel: Channel): any {
  const g = ((channel.group || '') + ' ' + (channel.displayName || '') + ' ' + (channel.name || '')).toLowerCase()
  let pool: string[]
  if (/sport|football|soccer|basketball|baseball|hockey|cricket|tennis|golf|boxing|mma|ufc|f1|nfl|nba|mlb|nhl|espn|bein/.test(g)) pool = SYNTH_PROGRAMS.sports
  else if (/news|cnn|bbc|al.jazeera|fox.news|msnbc/.test(g)) pool = SYNTH_PROGRAMS.news
  else if (/movie|cinema|film|action|comedy|drama|horror|scifi|western|classic/.test(g)) pool = SYNTH_PROGRAMS.movies
  else if (/music|mtv|vh1|country|jazz|classical/.test(g)) pool = SYNTH_PROGRAMS.music
  else if (/kid|child|cartoon|disney|nick|baby/.test(g)) pool = SYNTH_PROGRAMS.kids
  else if (/entertain|talk|show|reality|game/.test(g)) pool = SYNTH_PROGRAMS.entertainment
  else if (/docu|nature|history|science|wildlife|discovery|national.geo/.test(g)) pool = SYNTH_PROGRAMS.documentary
  else pool = SYNTH_PROGRAMS.general
  const seed = (channel.displayName || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const title = pool[seed % pool.length]
  const now = Date.now()
  const start = now - (15 + (seed % 30)) * 60 * 1000
  const end = start + (30 + (seed % 30)) * 60 * 1000
  const progress = Math.min(Math.round((now - start) / (end - start) * 100), 100)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (t: number) => {
    const d = new Date(t)
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`
  }
  return { channel: channel.tvgId || channel.id, title, start: fmt(start), stop: fmt(end), desc: `Scheduled programming on ${channel.displayName}.`, progress, isNow: true, synthesized: true }
}

// ═══ Constants ═══
const FAV_KEY = 'freestream.favorites'
const RECENT_KEY = 'freestream.recentChannels'
const ACTIVE_PATH_KEY = 'freestream.activePath'
const CUSTOM_KEY = 'freestream.customChannels'
const AUTOSKIP_KEY = 'freestream.autoSkip'
const HIDE_DEAD_KEY = 'freestream.hideDead'
const HIDE_BAD_KEY = 'freestream.hideBad'
const MAX_QUALITY_KEY = 'freestream.maxQuality'

export default function Home() {
  // ═══ Source state ═══
  const [activeProvider, setActiveProvider] = useState<Provider>(PROVIDERS[0])
  const [activeCategory, setActiveCategory] = useState<ProviderCategory | null>(PROVIDERS[0].categories[0])
  const [activePlaylistId, setActivePlaylistId] = useState<string | undefined>(undefined)

  // ═══ Playlist data ═══
  const [data, setData] = useState<PlaylistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ═══ Filters ═══
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>('__all')
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const [showRecentOnly, setShowRecentOnly] = useState(false)
  const [qualityFilter, setQualityFilter] = useState<'all' | '4k' | '1080p' | '720p' | 'sd'>('all')
  const [sortMode, setSortMode] = useState<'az' | 'za' | 'recent' | 'quality'>('az')
  const [hideDead, setHideDead] = useState(false)
  const [hideBad, setHideBad] = useState(false)
  const [autoSkip, setAutoSkip] = useState(false)
  const [maxQuality, setMaxQuality] = useState<'auto' | '480p' | '720p' | '1080p'>('auto')
  const [listView, setListView] = useState<ListViewMode>('grid')
  const [filterExpr, setFilterExpr] = useState('')
  const [filterError, setFilterError] = useState<string | null>(null)
  const filterFnRef = useRef<((ctx: any) => boolean) | null>(null)

  // ═══ Library ═══
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [deadChannels, setDeadChannels] = useState<Set<string>>(new Set())
  const [recentChannels, setRecentChannels] = useState<string[]>([])
  const [customChannels, setCustomChannels] = useState<Channel[]>([])
  const [language, setLanguage] = useState<'en' | 'ar'>('en')

  // ═══ Player ═══
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [pipActive, setPipActive] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // ═══ UI state ═══
  const [view, setView] = useState<View>('home')
  const [showMoreDrawer, setShowMoreDrawer] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [providerGridOpen, setProviderGridOpen] = useState(false)
  const [sidebarView, setSidebarView] = useState<'channels' | 'guide'>('channels')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ═══ Advanced tools ═══
  const [showMultiView, setShowMultiView] = useState(false)
  const [showDVR, setShowDVR] = useState(false)
  const [showSync, setShowSync] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<Channel[]>([])
  const [globalSearching, setGlobalSearching] = useState(false)
  const [syncKey, setSyncKey] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const [dvrRecording, setDvrRecording] = useState(false)
  const [showUploadDropzone, setShowUploadDropzone] = useState(false)
  const [customM3uUrl, setCustomM3uUrl] = useState('')
  const [adminTab, setAdminTab] = useState<'channels' | 'xtream' | 'stalker' | 'embed'>('channels')

  // ═══ Xtream ═══
  const [xcServer, setXcServer] = useState('')
  const [xcUser, setXcUser] = useState('')
  const [xcPass, setXcPass] = useState('')
  const [xcCreds, setXcCreds] = useState<XtreamCredentials | null>(null)
  const [xcStatus, setXcStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [xcMessage, setXcMessage] = useState('')

  // ═══ Stalker ═══
  const [stalkerUrl, setStalkerUrl] = useState('')
  const [stalkerMac, setStalkerMac] = useState('')
  const [stalkerCreds, setStalkerCreds] = useState<StalkerCredentials | null>(null)
  const [stalkerStatus, setStalkerStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [stalkerMessage, setStalkerMessage] = useState('')

  // ═══ EPG ═══
  const [epgNow, setEpgNow] = useState<any>(null)
  const [epgLoading, setEpgLoading] = useState(false)
  const [tvGuide, setTvGuide] = useState<any[]>([])
  const [guideLoading, setGuideLoading] = useState(false)
  const [guideGenres, setGuideGenres] = useState<any[]>([])
  const [activeGuideGenre, setActiveGuideGenre] = useState<string>('sports')

  // ═══ Quick-add embed inputs ═══
  const [twitchInput, setTwitchInput] = useState('')
  const [ytLiveInput, setYtLiveInput] = useState('')
  const [ytVodInput, setYtVodInput] = useState('')

  // ═══ Refresh nonce ═══
  const [refreshNonce, setRefreshNonce] = useState(0)

  // ═══ Refs ═══
  const deadChannelsRef = useRef<Set<string>>(new Set())
  const favoritesRef = useRef<Set<string>>(new Set())
  const recentChannelsRef = useRef<string[]>([])
  const currentChannelRef = useRef<Channel | null>(null)
  const filteredChannelsRef = useRef<Channel[]>([])
  const switchProviderRef = useRef<(provider: Provider) => void>(() => {})

  useEffect(() => { deadChannelsRef.current = deadChannels }, [deadChannels])
  useEffect(() => { favoritesRef.current = favorites }, [favorites])
  useEffect(() => { recentChannelsRef.current = recentChannels }, [recentChannels])
  useEffect(() => { currentChannelRef.current = currentChannel }, [currentChannel])

  // ═══ Language ═══
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
    try { localStorage.setItem('freestream.language', language) } catch {}
  }, [language])

  // ═══ Load persisted state ═══
  useEffect(() => {
    try {
      const favRaw = localStorage.getItem(FAV_KEY)
      if (favRaw) setFavorites(new Set(JSON.parse(favRaw)))
      localStorage.removeItem('freestream.deadChannels')
      setDeadChannels(new Set())
      const recentRaw = localStorage.getItem(RECENT_KEY)
      if (recentRaw) setRecentChannels(JSON.parse(recentRaw))
      setAutoSkip(localStorage.getItem(AUTOSKIP_KEY) === '1')
      setHideDead(localStorage.getItem(HIDE_DEAD_KEY) === '1')
      setHideBad(localStorage.getItem(HIDE_BAD_KEY) === '1')
      const mq = localStorage.getItem(MAX_QUALITY_KEY) as any
      if (mq) setMaxQuality(mq)
      const savedLang = localStorage.getItem('freestream.language') as 'en' | 'ar' | null
      if (savedLang) setLanguage(savedLang)
      const customRaw = localStorage.getItem(CUSTOM_KEY)
      if (customRaw) setCustomChannels(JSON.parse(customRaw))
      const pathRaw = localStorage.getItem(ACTIVE_PATH_KEY)
      if (pathRaw) {
        const path = JSON.parse(pathRaw)
        const prov = PROVIDERS.find(p => p.id === path.providerId)
        if (prov) {
          const cat = prov.categories.find(c => c.id === path.categoryId)
          if (cat) { setActiveProvider(prov); setActiveCategory(cat); setActivePlaylistId(path.playlistId) }
        }
      }
      const xcSaved = loadXtreamCreds()
      if (xcSaved) { setXcCreds(xcSaved); setXcServer(xcSaved.server); setXcUser(xcSaved.username); setXcPass(xcSaved.password) }
      const stSaved = loadStalkerCreds()
      if (stSaved) { setStalkerCreds(stSaved); setStalkerUrl(stSaved.portalUrl); setStalkerMac(stSaved.mac) }
      const key = localStorage.getItem('freestream.syncKey')
      if (key) setSyncKey(key)
    } catch {}
  }, [])

  // ═══ Persist ═══
  useEffect(() => { try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favorites))) } catch {} }, [favorites])
  useEffect(() => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentChannels)) } catch {} }, [recentChannels])
  useEffect(() => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customChannels)) } catch {} }, [customChannels])
  useEffect(() => { try { localStorage.setItem(AUTOSKIP_KEY, autoSkip ? '1' : '0') } catch {} }, [autoSkip])
  useEffect(() => { try { localStorage.setItem(HIDE_DEAD_KEY, hideDead ? '1' : '0') } catch {} }, [hideDead])
  useEffect(() => { try { localStorage.setItem(HIDE_BAD_KEY, hideBad ? '1' : '0') } catch {} }, [hideBad])
  useEffect(() => { try { localStorage.setItem(MAX_QUALITY_KEY, maxQuality) } catch {} }, [maxQuality])
  useEffect(() => {
    if (activeProvider && activeCategory) {
      try { localStorage.setItem(ACTIVE_PATH_KEY, JSON.stringify({ providerId: activeProvider.id, categoryId: activeCategory.id, playlistId: activePlaylistId })) } catch {}
    }
  }, [activeProvider, activeCategory, activePlaylistId])

  // ═══ Fetch playlist ═══
  const fetchPlaylist = useCallback(async () => {
    if (!activeProvider || !activeCategory) return
    if (activeProvider.id === 'my-channels') {
      setLoading(false); setError(null)
      const channels = customChannels
      const groups = Array.from(new Set(channels.map(c => c.group || 'Other'))).sort()
      setData({ channels, groups, totalCount: channels.length, sourceKey: 'my-channels' })
      const deadSet = deadChannelsRef.current
      const first = channels.find(c => !deadSet.has(c.url))
      if (first) setCurrentChannel(first)
      else if (channels.length > 0) setCurrentChannel(channels[0])
      else setCurrentChannel(null)
      return
    }
    if (activeProvider.id === 'xtream') {
      const creds = loadXtreamCreds()
      if (!creds) {
        setLoading(false)
        setError('No Xtream Codes credentials. Open More → Admin → Xtream tab.')
        setData({ channels: [], groups: [], totalCount: 0, sourceKey: 'xtream' })
        return
      }
      setLoading(true); setError(null); setData(null); setActiveGroup('__all'); setSearch('')
      try {
        const result = await xtreamM3U(creds)
        const channels: Channel[] = (result.channels || []).map((ch: any, i: number) => ({ ...ch, id: ch.id || `xc-${i}`, group: ch.group || 'Xtream', isVod: ch.isVod }))
        const groups = Array.from(new Set(channels.map(c => c.group || 'Other'))).sort()
        setData({ channels, groups, totalCount: channels.length, sourceKey: 'xtream' })
        const deadSet = deadChannelsRef.current
        const first = channels.find(c => !deadSet.has(c.url))
        if (first) setCurrentChannel(first)
        else if (channels.length > 0) setCurrentChannel(channels[0])
      } catch (e: any) { setError(`Xtream: ${e.message}`) }
      finally { setLoading(false) }
      return
    }
    setLoading(true); setError(null); setData(null); setActiveGroup('__all'); setSearch('')
    try {
      const params = new URLSearchParams({ provider: activeProvider.id, category: activeCategory.id })
      if (activePlaylistId) params.set('playlist', activePlaylistId)
      if (activeProvider.id === 'auto-updated' || activeProvider.id === 'embeds' || activeProvider.id === 'football-live') params.set('refresh', '1')
      if (refreshNonce > 0) params.set('refresh', '1')
      const res = await fetch(`/api/playlist?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
      const deadSet = deadChannelsRef.current
      const first = (json.channels as Channel[]).find(c => !deadSet.has(c.url))
      if (first) setCurrentChannel(first)
      else if (json.channels?.length > 0) setCurrentChannel(json.channels[0])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [activeProvider, activeCategory, activePlaylistId, refreshNonce, customChannels])

  useEffect(() => { fetchPlaylist() }, [fetchPlaylist])

  // ═══ Channel actions ═══
  const toggleFav = useCallback((ch: Channel) => {
    setFavorites(prev => { const n = new Set(prev); if (n.has(ch.url)) n.delete(ch.url); else n.add(ch.url); return n })
  }, [])
  const isFav = useCallback((ch: Channel) => favorites.has(ch.url), [favorites])
  const markDead = useCallback((ch: Channel) => { setDeadChannels(prev => { const n = new Set(prev); n.add(ch.url); return n }) }, [])
  const unmarkDead = useCallback((ch: Channel) => { setDeadChannels(prev => { const n = new Set(prev); n.delete(ch.url); return n }) }, [])
  const isDead = useCallback((ch: Channel) => deadChannels.has(ch.url), [deadChannels])
  const recordRecent = useCallback((ch: Channel) => {
    setRecentChannels(prev => [ch.url, ...prev.filter(u => u !== ch.url)].slice(0, 20))
  }, [])

  const handleSelectChannel = useCallback((ch: Channel) => {
    setCurrentChannel(ch); recordRecent(ch)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [recordRecent])

  const handlePlayerError = useCallback((_msg: string) => {}, [])

  const goToNextChannel = useCallback(() => {
    const list = filteredChannelsRef.current; const cur = currentChannelRef.current
    if (!list || !list.length || !cur) return
    const deadSet = deadChannelsRef.current
    const idx = list.findIndex(c => c.url === cur.url)
    if (idx === -1) return
    for (let i = idx + 1; i < list.length; i++) { if (!deadSet.has(list[i].url)) { setCurrentChannel(list[i]); return } }
    for (let i = 0; i < idx; i++) { if (!deadSet.has(list[i].url)) { setCurrentChannel(list[i]); return } }
  }, [])

  const goToPrevChannel = useCallback(() => {
    const list = filteredChannelsRef.current; const cur = currentChannelRef.current
    if (!list || !list.length || !cur) return
    const deadSet = deadChannelsRef.current
    const idx = list.findIndex(c => c.url === cur.url)
    if (idx === -1) return
    for (let i = idx - 1; i >= 0; i--) { if (!deadSet.has(list[i].url)) { setCurrentChannel(list[i]); return } }
    for (let i = list.length - 1; i > idx; i--) { if (!deadSet.has(list[i].url)) { setCurrentChannel(list[i]); return } }
  }, [])

  const copyStreamUrl = useCallback(async (ch: Channel) => {
    try { await navigator.clipboard.writeText(ch.url); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000) } catch {}
  }, [])

  const togglePiP = useCallback(async () => {
    const v = videoRef.current; if (!v) return
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); setPipActive(false) }
      else { await v.requestPictureInPicture(); setPipActive(true) }
    } catch {}
  }, [])

  // ═══ Provider switching ═══
  const switchProvider = useCallback((provider: Provider) => {
    setActiveProvider(provider); setActiveCategory(provider.categories[0])
    const fc = provider.categories[0]
    setActivePlaylistId(fc.playlists && fc.playlists.length > 0 ? fc.playlists[0].id : undefined)
  }, [])
  useEffect(() => { switchProviderRef.current = switchProvider }, [switchProvider])

  const switchCategory = useCallback((cat: ProviderCategory) => {
    setActiveCategory(cat)
    setActivePlaylistId(cat.playlists && cat.playlists.length > 0 ? cat.playlists[0].id : undefined)
  }, [])

  // ═══ Filtering ═══
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
    if (hideBad) list = list.filter(c => !c.not247 && !c.geoBlocked)
    if (hideDead) list = list.filter(c => !deadChannels.has(c.url))
    if (filterFnRef.current) {
      const fn = filterFnRef.current
      list = list.filter(c => fn({ name: c.displayName || c.name || '', group: c.group || '', url: c.url || '', logo: c.logo || '', quality: c.quality || '', country: c.countryCode || c.country || '' }))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c => c.displayName.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.group || '').toLowerCase().includes(q) || (c.country || '').toLowerCase().includes(q))
    }
    const sorted = [...list]
    if (sortMode === 'az') sorted.sort((a, b) => a.displayName.localeCompare(b.displayName))
    else if (sortMode === 'za') sorted.sort((a, b) => b.displayName.localeCompare(a.displayName))
    else if (sortMode === 'quality') sorted.sort((a, b) => (b.qualityTier ?? 0) - (a.qualityTier ?? 0))
    else if (sortMode === 'recent') {
      const idx = (url: string) => recentChannels.indexOf(url)
      sorted.sort((a, b) => { const ai = idx(a.url), bi = idx(b.url); if (ai === -1 && bi === -1) return a.displayName.localeCompare(b.displayName); if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi })
    }
    return sorted
  }, [data, search, activeGroup, showFavsOnly, showRecentOnly, favorites, deadChannels, hideDead, hideBad, qualityFilter, sortMode, recentChannels, recentSet, filterExpr])

  useEffect(() => { filteredChannelsRef.current = filteredChannels }, [filteredChannels])

  const groupCounts = useMemo(() => {
    if (!data) return new Map<string, number>()
    const m = new Map<string, number>()
    let list = data.channels
    if (showFavsOnly) list = list.filter(c => favorites.has(c.url))
    if (showRecentOnly) list = list.filter(c => recentSet.has(c.url))
    if (hideBad) list = list.filter(c => !c.not247 && !c.geoBlocked)
    if (hideDead) list = list.filter(c => !deadChannels.has(c.url))
    for (const c of list) { const g = c.group || 'Other'; m.set(g, (m.get(g) ?? 0) + 1) }
    return m
  }, [data, showFavsOnly, showRecentOnly, favorites, deadChannels, hideDead, hideBad, recentSet])

  // ═══ Filter DSL ═══
  useEffect(() => {
    if (!filterExpr.trim()) { filterFnRef.current = null; setFilterError(null); return }
    const r = tryCompileFilter(filterExpr)
    if (r.ok) { filterFnRef.current = r.fn; setFilterError(null) }
    else { filterFnRef.current = null; setFilterError(r.error) }
  }, [filterExpr])

  // ═══ EPG ═══
  useEffect(() => {
    if (!currentChannel) { setEpgNow(null); return }
    let cancelled = false; setEpgLoading(true)
    const matchKey = currentChannel.tvgId || currentChannel.displayName || ''
    if (!matchKey) { setEpgNow(null); setEpgLoading(false); return }
    fetch(`/api/epg?channel=${encodeURIComponent(matchKey)}&limit=5`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return
        const channels = json?.channels || []
        let best = channels.find((c: any) => c.id === matchKey)
        if (!best && currentChannel.tvgId) { const tid = currentChannel.tvgId; best = channels.find((c: any) => c.id.toLowerCase().endsWith('.' + tid.toLowerCase())) }
        if (!best) best = channels.find((c: any) => c.name.toLowerCase().includes(currentChannel.displayName.toLowerCase()) || currentChannel.displayName.toLowerCase().includes(c.name.toLowerCase()))
        const now = best?.programs?.find((p: any) => p.isNow)
        setEpgNow(now || synthesizeNowPlaying(currentChannel))
      })
      .catch(() => { if (!cancelled) setEpgNow(synthesizeNowPlaying(currentChannel)) })
      .finally(() => { if (!cancelled) setEpgLoading(false) })
    return () => { cancelled = true }
  }, [currentChannel])

  // ═══ TV Guide ═══
  const fetchGuide = useCallback(async () => {
    setGuideLoading(true)
    try {
      const res = await fetch('/api/tv-guide?limit=40')
      const json = await res.json()
      setGuideGenres(json.genres || [])
      const all: any[] = []
      for (const g of (json.genres || [])) { for (const ch of (g.channels || [])) { all.push({ ...ch, genre: g.id, genreName: g.name, genreFlag: g.flag }) } }
      setTvGuide(all)
    } catch { setTvGuide([]); setGuideGenres([]) }
    finally { setGuideLoading(false) }
  }, [])
  useEffect(() => { fetchGuide() }, [fetchGuide])

  // ═══ Keyboard shortcuts ═══
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.ctrlKey || e.altKey || e.metaKey) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setGlobalSearchOpen(true) }
        return
      }
      if (e.key === 'Escape') { setGlobalSearchOpen(false); setShowMoreDrawer(false); setShowSettings(false); setShowAdmin(false); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); goToPrevChannel(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); goToNextChannel(); return }
      if (e.key === ' ') { e.preventDefault(); const v = videoRef.current; if (v) { if (v.paused) v.play(); else v.pause() } return }
      if (e.key === 'f' || e.key === 'F') { const v = videoRef.current; if (v) { if (document.fullscreenElement) document.exitFullscreen(); else v.requestFullscreen?.() } return }
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePiP(); return }
      if (/^[0-9]$/.test(e.key)) { const list = filteredChannelsRef.current; const idx = e.key === '0' ? 9 : parseInt(e.key) - 1; if (list && list[idx]) handleSelectChannel(list[idx]); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goToNextChannel, goToPrevChannel, handleSelectChannel, togglePiP])

  // ═══ Drag-and-drop M3U ═══
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer?.types.includes('Files')) setShowUploadDropzone(true) }
    const handleDragLeave = (e: DragEvent) => { if (e.relatedTarget === null) setShowUploadDropzone(false) }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault(); setShowUploadDropzone(false)
      const file = e.dataTransfer?.files?.[0]
      if (file && file.name.match(/\.m3u8?$/i)) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const text = ev.target?.result as string; if (!text) return
          const blob = new Blob([text], { type: 'audio/mpegurl' }); const url = URL.createObjectURL(blob)
          fetch(`/api/playlist?url=${encodeURIComponent(url)}&refresh=1`).then(rr => rr.json()).then(json => {
            const channels: Channel[] = (json.channels || []).map((ch: Channel, i: number) => ({ ...ch, id: `upload-${Date.now()}-${i}`, group: ch.group || file.name.replace(/\.m3u8?$/i, '') }))
            setCustomChannels(prev => [...channels, ...prev]); URL.revokeObjectURL(url)
            const myProv = PROVIDERS.find(p => p.id === 'my-channels'); if (myProv) switchProviderRef.current(myProv)
          }).catch(err => alert(`Failed to parse M3U: ${err.message}`))
        }
        reader.readAsText(file)
      }
    }
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    return () => { window.removeEventListener('dragover', handleDragOver); window.removeEventListener('dragleave', handleDragLeave); window.removeEventListener('drop', handleDrop) }
  }, [])

  // ═══ Global search ═══
  useEffect(() => {
    if (!globalSearchQuery.trim()) { setGlobalSearchResults([]); return }
    const t = setTimeout(() => {
      const q = globalSearchQuery.trim()
      if (q.length < 2) return
      setGlobalSearching(true)
      fetch(`https://iptv-org.github.io/api/search.json?q=${encodeURIComponent(q)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.channels) {
            setGlobalSearchResults(d.channels.slice(0, 50).map((c: any, i: number) => ({
              id: `global-${i}`, name: c.name, displayName: c.name, rawName: c.name,
              url: c.streams?.[0]?.url || c.url || '', logo: c.logo,
              group: c.category || c.country || 'Global Search', country: c.country, countryCode: c.country, tvgId: c.id,
            })).filter((c: Channel) => c.url))
          }
        }).catch(() => {}).finally(() => setGlobalSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [globalSearchQuery])

  // ═══ Xtream handlers ═══
  const handleXtreamLogin = useCallback(async () => {
    if (!xcServer.trim() || !xcUser.trim() || !xcPass.trim()) return
    setXcStatus('loading'); setXcMessage('Connecting…')
    try {
      const creds: XtreamCredentials = { server: xcServer.trim().replace(/\/+$/, ''), username: xcUser.trim(), password: xcPass.trim() }
      const info = await xtreamAuth(creds)
      const ui = info?.user_info
      if (ui && info?.server_info) {
        const ok = ui.auth === 1 || ui.status === 'Active' || ui.status === 'active' || (ui.auth !== 0 && !ui.message?.toLowerCase?.().includes('invalid'))
        if (ok) {
          saveXtreamCreds(creds); setXcCreds(creds); setXcStatus('ok')
          setXcMessage(`✓ Connected — ${ui.username} · expires ${ui.exp_date ? new Date(parseInt(ui.exp_date) * 1000).toLocaleDateString() : 'unknown'}`)
        } else { setXcStatus('error'); setXcMessage(`✗ Auth failed: ${ui.message || 'Invalid credentials'}`) }
      } else { setXcStatus('error'); setXcMessage('✗ No valid user_info — check server URL + port') }
    } catch (e: any) {
      setXcStatus('error'); setXcMessage(`✗ ${e.message}\n\nCommon causes:\n• Server URL wrong or missing port\n• HTTP-only server on HTTPS site\n• Server offline`)
    }
  }, [xcServer, xcUser, xcPass])

  const handleXtreamDemo = useCallback(async () => {
    setXcServer(DEMO_XTREAM_CREDS.server); setXcUser(DEMO_XTREAM_CREDS.username); setXcPass(DEMO_XTREAM_CREDS.password)
    setXcStatus('loading'); setXcMessage('Connecting to demo…')
    try {
      const info = await xtreamAuth(DEMO_XTREAM_CREDS)
      saveXtreamCreds(DEMO_XTREAM_CREDS); setXcCreds(DEMO_XTREAM_CREDS); setXcStatus('ok')
      setXcMessage(`✓ Demo connected — 16 live channels + 5 VOD`)
    } catch (e: any) { setXcStatus('error'); setXcMessage(`✗ Demo failed: ${e.message}`) }
  }, [])

  // ═══ Stalker handlers ═══
  const handleStalkerLogin = useCallback(async () => {
    if (!stalkerUrl.trim() || !stalkerMac.trim()) return
    setStalkerStatus('loading'); setStalkerMessage('Connecting…')
    try {
      const creds: StalkerCredentials = { portalUrl: stalkerUrl.trim().replace(/\/+$/, ''), mac: stalkerMac.trim() }
      await stalkerHandshake(creds)
      saveStalkerCreds(creds); setStalkerCreds(creds); setStalkerStatus('ok')
      setStalkerMessage('✓ Connected — click "Load channels" to browse.')
    } catch (e: any) { setStalkerStatus('error'); setStalkerMessage(`✗ ${e.message}`) }
  }, [stalkerUrl, stalkerMac])

  // ═══ Sync handlers ═══
  const handleSyncPush = useCallback(async () => {
    if (!syncKey) return; setSyncStatus('syncing')
    try {
      await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: syncKey, favorites: Array.from(favorites), recent: recentChannels, customChannels }) })
      setSyncStatus('ok'); setTimeout(() => setSyncStatus('idle'), 3000)
    } catch { setSyncStatus('error') }
  }, [syncKey, favorites, recentChannels, customChannels])

  const handleSyncPull = useCallback(async () => {
    if (!syncKey) return; setSyncStatus('syncing')
    try {
      const res = await fetch(`/api/sync?key=${syncKey}`); const d = await res.json()
      if (d.ok) { if (d.favorites) setFavorites(new Set(d.favorites)); if (d.recent) setRecentChannels(d.recent); if (d.customChannels) setCustomChannels(d.customChannels); setSyncStatus('ok'); setTimeout(() => setSyncStatus('idle'), 3000) }
      else setSyncStatus('error')
    } catch { setSyncStatus('error') }
  }, [syncKey])

  const handleSyncCreate = useCallback(async () => {
    setSyncStatus('syncing')
    try {
      const res = await fetch('/api/sync?new=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites: Array.from(favorites), recent: recentChannels, customChannels }) })
      const d = await res.json()
      if (d.key) { setSyncKey(d.key); localStorage.setItem('freestream.syncKey', d.key); setSyncStatus('ok'); setTimeout(() => setSyncStatus('idle'), 3000) }
    } catch { setSyncStatus('error') }
  }, [favorites, recentChannels, customChannels])

  // ═══ Quick-add embed ═══
  const addTwitchChannel = useCallback(() => {
    const name = twitchInput.trim().replace(/^twitch:/i, ''); if (!name) return
    const ch: Channel = { id: `twitch-${Date.now()}`, name: `Twitch — ${name}`, displayName: `Twitch — ${name}`, rawName: `Twitch — ${name}`, url: `twitch:${name}`, group: 'Twitch', isVod: false, logo: 'https://assets.help.twitch.tv/article/img/658115-02.png' }
    setCustomChannels(prev => [ch, ...prev]); setTwitchInput('')
    const p = PROVIDERS.find(x => x.id === 'my-channels'); if (p) switchProviderRef.current(p)
  }, [twitchInput])

  const addYtLiveChannel = useCallback(() => {
    const id = ytLiveInput.trim().replace(/^youtube-live:/i, ''); if (!id) return
    const ch: Channel = { id: `yt-live-${Date.now()}`, name: `YouTube Live — ${id.slice(0, 16)}`, displayName: `YouTube Live — ${id.slice(0, 16)}`, rawName: `YouTube Live — ${id}`, url: `youtube-live:${id}`, group: 'YouTube', isVod: false, logo: 'https://www.youtube.com/s/desktop/favicon.ico' }
    setCustomChannels(prev => [ch, ...prev]); setYtLiveInput('')
    const p = PROVIDERS.find(x => x.id === 'my-channels'); if (p) switchProviderRef.current(p)
  }, [ytLiveInput])

  const addYtVodChannel = useCallback(() => {
    const id = ytVodInput.trim().replace(/^youtube:/i, ''); if (!id) return
    const ch: Channel = { id: `yt-vod-${Date.now()}`, name: `YouTube — ${id}`, displayName: `YouTube — ${id}`, rawName: `YouTube — ${id}`, url: `youtube:${id}`, group: 'YouTube VOD', isVod: true, logo: 'https://www.youtube.com/s/desktop/favicon.ico' }
    setCustomChannels(prev => [ch, ...prev]); setYtVodInput('')
    const p = PROVIDERS.find(x => x.id === 'my-channels'); if (p) switchProviderRef.current(p)
  }, [ytVodInput])

  // ═══ Custom channel add ═══
  const [adminChannelName, setAdminChannelName] = useState('')
  const [adminChannelUrl, setAdminChannelUrl] = useState('')
  const [adminChannelLogo, setAdminChannelLogo] = useState('')
  const [adminChannelGroup, setAdminChannelGroup] = useState('Custom')

  const addCustomChannel = useCallback(() => {
    if (!adminChannelName.trim() || !adminChannelUrl.trim()) return
    const ch: Channel = { id: `custom-${Date.now()}`, name: adminChannelName.trim(), displayName: adminChannelName.trim(), rawName: adminChannelName.trim(), url: adminChannelUrl.trim(), logo: adminChannelLogo.trim() || undefined, group: adminChannelGroup.trim() || 'Custom', not247: false, isVod: /\.(mp4|mkv|avi|mov|webm)/.test(adminChannelUrl.toLowerCase()), geoBlocked: false }
    setCustomChannels(prev => [ch, ...prev]); setAdminChannelName(''); setAdminChannelUrl(''); setAdminChannelLogo(''); setAdminChannelGroup('Custom')
    const p = PROVIDERS.find(x => x.id === 'my-channels'); if (p) switchProviderRef.current(p)
  }, [adminChannelName, adminChannelUrl, adminChannelLogo, adminChannelGroup])

  const loadCustomM3u = useCallback(async () => {
    if (!customM3uUrl.trim()) return
    try {
      const res = await fetch(`/api/playlist?url=${encodeURIComponent(customM3uUrl.trim())}&refresh=1`)
      const json = await res.json(); if (!res.ok) throw new Error(json.error)
      const loaded: Channel[] = (json.channels || []).map((ch: Channel, i: number) => ({ ...ch, id: `custom-m3u-${Date.now()}-${i}`, group: ch.group || 'Custom M3U' }))
      setCustomChannels(prev => [...loaded, ...prev]); setCustomM3uUrl('')
      const p = PROVIDERS.find(x => x.id === 'my-channels'); if (p) switchProviderRef.current(p)
    } catch (e: any) { alert(`Failed to load M3U: ${e.message}`) }
  }, [customM3uUrl])

  // ═══ Derived data ═══
  const allChannels = useMemo(() => data?.channels || [], [data])
  const liveNowChannels = useMemo(() => allChannels.slice(0, 20), [allChannels])
  const favChannels = useMemo(() => allChannels.filter(c => favorites.has(c.url)), [allChannels, favorites])
  const recentChannelObjs = useMemo(() => {
    return recentChannels.map(url => allChannels.find(c => c.url === url)).filter(Boolean).slice(0, 10) as Channel[]
  }, [recentChannels, allChannels])

  // ═══ Category tiles data ═══
  const categoryTiles = useMemo(() => [
    { name: 'Sports', flag: '⚽', prov: 'best-of', cat: 'sports' },
    { name: 'Movies', flag: '🎬', prov: 'best-of', cat: 'movies' },
    { name: 'News', flag: '📰', prov: 'best-of', cat: 'news' },
    { name: 'Music', flag: '🎵', prov: 'best-of', cat: 'music' },
    { name: 'Kids', flag: '👶', prov: 'best-of', cat: 'kids' },
    { name: 'Entertainment', flag: '🎪', prov: 'best-of', cat: 'entertainment' },
    { name: 'Documentary', flag: '🔬', prov: 'best-of', cat: 'documentary' },
    { name: 'International', flag: '🌍', prov: 'best-of', cat: 'international' },
  ].map(t => {
    const prov = PROVIDERS.find(p => p.id === t.prov)
    const category = prov?.categories.find(c => c.id === t.cat)
    return { ...t, prov, category }
  }).filter(t => t.prov && t.category), [])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ═══ Top Navigation ═══ */}
      <header className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="px-4 md:px-6 py-3 flex items-center gap-4">
          {/* Logo */}
          <button onClick={() => setView('home')} className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold tracking-tight leading-none">FreeStream TV</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Free live TV</p>
            </div>
          </button>

          {/* Primary nav */}
          <nav className="hidden md:flex items-center gap-1">
            {(['home', 'live', 'guide'] as const).map(v => (
              <button key={v} onClick={() => { setView(v); if (v === 'guide') setSidebarView('guide'); else setSidebarView('channels') }}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition', view === v ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-white/5')}>
                {v === 'home' ? 'Home' : v === 'live' ? 'Live TV' : 'TV Guide'}
              </button>
            ))}
          </nav>

          {/* Search */}
          <div className="flex-1 max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search live TV…" value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => { if (view === 'home') setView('live') }}
              className="pl-9 bg-white/5 border-white/5 h-9" />
            <button onClick={() => setGlobalSearchOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-white/5 hover:bg-white/10">⌘K</button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setShowFavsOnly(v => !v); setShowRecentOnly(false); setView('live') }}
              className={cn('p-2 rounded-lg transition relative', showFavsOnly ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-white/5')}>
              <Heart className={cn('w-4 h-4', showFavsOnly && 'fill-current')} />
              {favorites.size > 0 && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-[8px] flex items-center justify-center text-white font-bold">{favorites.size > 9 ? '9+' : favorites.size}</span>}
            </button>
            <button onClick={() => setShowMoreDrawer(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"><Settings className="w-4 h-4" /></button>
            <a href="/download/FreeStreamTV.apk" download className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30"><Smartphone className="w-4 h-4" /></a>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden flex items-center gap-1 px-4 pb-2">
          {(['home', 'live', 'guide'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); if (v === 'guide') setSidebarView('guide'); else setSidebarView('channels') }}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium', view === v ? 'bg-white/10 text-white' : 'text-muted-foreground')}>{v}</button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setShowMoreDrawer(true)} className="px-3 py-1 rounded-lg text-xs text-muted-foreground">More</button>
        </div>
      </header>

      {/* ═══ HOME VIEW ═══ */}
      {view === 'home' && (
        <div className="flex-1 overflow-y-auto thin-scroll page-enter">
          <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
            {/* Hero */}
            {currentChannel ? (
              <div className="space-y-4">
                <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
                  {isEmbedUrl(currentChannel.url) ? (
                    <EmbedPlayer url={currentChannel.url} channelName={currentChannel.displayName} poster={currentChannel.logo} onError={handlePlayerError} onNext={goToNextChannel} autoSkip={autoSkip} maxQuality={maxQuality} externalVideoRef={videoRef} />
                  ) : (
                    <VideoPlayer src={currentChannel.url} poster={currentChannel.logo} channelName={currentChannel.displayName} onError={handlePlayerError} onNext={goToNextChannel} autoSkip={autoSkip} maxQuality={maxQuality} externalVideoRef={videoRef} />
                  )}
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex items-center gap-1 text-xs font-bold text-primary">
                        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>LIVE
                      </span>
                      {currentChannel.quality && <span className="text-[10px] font-bold px-1.5 py-0 rounded bg-white/10 uppercase">{currentChannel.quality}</span>}
                      {currentChannel.countryCode && <span className="text-xs text-muted-foreground">{flagForCountry(currentChannel.countryCode)} {currentChannel.countryCode.toUpperCase()}</span>}
                      {epgNow && <span className="text-xs text-muted-foreground">· {epgNow.title}</span>}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{currentChannel.displayName}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{currentChannel.group}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant={isFav(currentChannel) ? 'default' : 'outline'} size="sm" onClick={() => toggleFav(currentChannel)} className="gap-2">
                      <Heart className={cn('w-4 h-4', isFav(currentChannel) && 'fill-current')} />{isFav(currentChannel) ? 'Saved' : 'Save'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setView('live')} className="gap-2"><Tv className="w-4 h-4" /> Browse</Button>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="aspect-video rounded-2xl shimmer" />
            ) : (
              <EmptyState type="source" action={{ label: 'Browse Sources', onClick: () => setView('live') }} />
            )}

            {/* Continue Watching */}
            {recentChannelObjs.length > 0 && (
              <ContentRail title="Continue Watching" channels={recentChannelObjs} currentChannel={currentChannel} favorites={favorites} deadChannels={deadChannels} recentSet={recentSet} onSelectChannel={handleSelectChannel} onToggleFav={toggleFav} />
            )}

            {/* Live Now */}
            {liveNowChannels.length > 0 && (
              <ContentRail title="Live Now" channels={liveNowChannels} currentChannel={currentChannel} favorites={favorites} deadChannels={deadChannels} recentSet={recentSet} onSelectChannel={handleSelectChannel} onToggleFav={toggleFav} />
            )}

            {/* Category tiles */}
            <section>
              <h2 className="text-xl font-bold mb-3">Browse by Category</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
                {categoryTiles.map(t => (
                  <button key={t.name} onClick={() => { if (t.prov && t.category) { switchProvider(t.prov); switchCategory(t.category); setView('live') } }}
                    className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] hover:from-white/[0.10] hover:to-white/[0.04] p-4 flex flex-col items-center justify-center gap-2 card-hover">
                    <span className="text-3xl">{t.flag}</span>
                    <span className="text-sm font-semibold">{t.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Featured Sources */}
            <section>
              <h2 className="text-xl font-bold mb-3">Featured Sources</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {PROVIDERS.filter(p => p.tier === 'featured').map(p => (
                  <button key={p.id} onClick={() => { switchProvider(p); setView('live') }}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] hover:from-white/[0.10] hover:to-white/[0.04] card-hover">
                    {p.logo ? <img src={p.logo} alt="" className="w-10 h-10 object-contain" /> : <span className="text-2xl">{p.flag}</span>}
                    <span className="text-xs font-semibold text-center leading-tight">{p.name}</span>
                    {p.countLabel && <span className="text-[10px] text-muted-foreground text-center">{p.countLabel}</span>}
                  </button>
                ))}
              </div>
            </section>

            {/* Regional Sources */}
            <section>
              <h2 className="text-xl font-bold mb-3">More Free Services</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {PROVIDERS.filter(p => p.tier === 'regional').map(p => (
                  <button key={p.id} onClick={() => { switchProvider(p); setView('live') }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] card-hover">
                    {p.logo ? <img src={p.logo} alt="" className="w-7 h-7 object-contain" /> : <span className="text-lg">{p.flag}</span>}
                    <span className="text-[11px] font-medium text-center leading-tight">{p.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Power User Tools */}
            <section>
              <h2 className="text-xl font-bold mb-3">Advanced Tools</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {PROVIDERS.filter(p => p.tier === 'power').map(p => (
                  <button key={p.id} onClick={() => { switchProvider(p); setView('live') }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] card-hover">
                    <span className="text-lg">{p.flag}</span>
                    <span className="text-[11px] font-medium text-center">{p.name}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ═══ LIVE TV VIEW ═══ */}
      {view === 'live' && (
        <div className="flex-1 flex relative">
          {/* Sidebar */}
          <aside className={cn('absolute lg:static inset-y-0 left-0 z-20 w-64 bg-sidebar border-r border-white/5 transition-transform flex flex-col', sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
            <div className="p-3 border-b border-white/5">
              <div className="flex gap-1 mb-2">
                <button onClick={() => setSidebarView('channels')} className={cn('flex-1 px-3 py-1.5 rounded-lg text-xs font-medium', sidebarView === 'channels' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-white/5')}>Channels</button>
                <button onClick={() => setSidebarView('guide')} className={cn('flex-1 px-3 py-1.5 rounded-lg text-xs font-medium', sidebarView === 'guide' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-white/5')}>Guide</button>
              </div>
              {sidebarView === 'channels' && (
                <div className="flex gap-2">
                  <Select value={qualityFilter} onValueChange={(v: any) => setQualityFilter(v)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="4k">4K</SelectItem><SelectItem value="1080p">1080p+</SelectItem><SelectItem value="720p">720p+</SelectItem></SelectContent></Select>
                  <Select value={sortMode} onValueChange={(v: any) => setSortMode(v)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="az">A→Z</SelectItem><SelectItem value="za">Z→A</SelectItem><SelectItem value="recent">Recent</SelectItem><SelectItem value="quality">Quality</SelectItem></SelectContent></Select>
                </div>
              )}
            </div>
            {sidebarView === 'guide' ? (
              <ScrollArea className="flex-1 thin-scroll">
                <div className="p-3">
                  {guideGenres.length > 0 && (
                    <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar">
                      {guideGenres.map((g: any) => <button key={g.id} onClick={() => setActiveGuideGenre(g.id)} className={cn('px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap', activeGuideGenre === g.id ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-white/5')}><span>{g.flag}</span> {g.name}</button>)}
                    </div>
                  )}
                  {guideLoading ? <SkeletonRail title="Loading…" /> : (() => {
                    const ag = guideGenres.find((g: any) => g.id === activeGuideGenre)
                    const channels = ag?.channels || []
                    return channels.length === 0 ? <EmptyState type="channels" /> : (
                      <div className="space-y-1">
                        {channels.map((ch: any, i: number) => (
                          <div key={i} className="p-2 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => { const co: Channel = { id: `guide-${i}`, name: ch.name, displayName: ch.displayName, url: ch.url, logo: ch.logo, group: ch.group || activeGuideGenre, quality: ch.quality, isVod: ch.isVod }; handleSelectChannel(co); setSidebarView('channels') }}>
                            <div className="flex items-center gap-2 mb-0.5">
                              {ch.logo ? <img src={ch.logo} alt="" className="w-5 h-5 object-contain rounded-sm" /> : <Tv className="w-4 h-4 text-muted-foreground" />}
                              <span className="text-xs font-medium truncate flex-1">{ch.displayName}</span>
                              <Badge variant="outline" className="text-[10px] gap-0.5"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" /></span>LIVE</Badge>
                            </div>
                            {ch.group && <p className="text-xs text-white/40 truncate pl-7">{ch.group}</p>}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="flex-1 thin-scroll">
                <div className="p-2 space-y-0.5">
                  {data && <p className="px-3 py-1 text-xs text-muted-foreground">{data.totalCount.toLocaleString()} channels · {data.groups.length} types</p>}
                  <button onClick={() => { setActiveGroup('__all'); setShowFavsOnly(false); setShowRecentOnly(false); setSidebarOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white/5"><Globe className="w-4 h-4" /> All Channels <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{data?.channels.length.toLocaleString() || 0}</span></button>
                  <button onClick={() => { setShowFavsOnly(true); setShowRecentOnly(false); setActiveGroup('__all'); setSidebarOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white/5"><Star className="w-4 h-4" /> Favorites <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{favorites.size}</span></button>
                  <button onClick={() => { setShowRecentOnly(true); setShowFavsOnly(false); setActiveGroup('__all'); setSidebarOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white/5"><Clock className="w-4 h-4" /> Recent <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{recentChannels.length}</span></button>
                  <div className="my-2 h-px bg-white/5" />
                  <p className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">Categories</p>
                  {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 mx-2 shimmer rounded-lg" />) : data?.groups.map((g: string) => ({ g, count: groupCounts.get(g) ?? 0 })).filter(({ count }) => count > 0).sort((a, b) => b.count - a.count).map(({ g, count }) => (
                    <button key={g} onClick={() => { setActiveGroup(g); setShowFavsOnly(false); setShowRecentOnly(false); setSidebarOpen(false) }} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium', activeGroup === g && !showFavsOnly && !showRecentOnly ? 'bg-primary text-white' : 'hover:bg-white/5')}>
                      <span className="flex-1 text-left truncate">{g}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', activeGroup === g ? 'bg-white/20' : 'bg-white/5 text-muted-foreground')}>{count}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </aside>

          {sidebarOpen && <div className="absolute inset-0 z-10 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

          {/* Main content */}
          <main className="flex-1 min-w-0 flex flex-col lg:flex-row">
            {/* Player */}
            <section className="lg:w-2/3 xl:w-3/4 p-3 md:p-6 space-y-4">
              {currentChannel ? (
                <>
                  {isEmbedUrl(currentChannel.url) ? (
                    <EmbedPlayer url={currentChannel.url} channelName={currentChannel.displayName} poster={currentChannel.logo} onError={handlePlayerError} onNext={goToNextChannel} autoSkip={autoSkip} maxQuality={maxQuality} externalVideoRef={videoRef} />
                  ) : (
                    <VideoPlayer src={currentChannel.url} poster={currentChannel.logo} channelName={currentChannel.displayName} onError={handlePlayerError} onNext={goToNextChannel} autoSkip={autoSkip} maxQuality={maxQuality} externalVideoRef={videoRef} />
                  )}
                  {/* EPG panel */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">Now Playing</span>
                      {epgLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      {epgNow?.synthesized && <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">SYNTH</Badge>}
                    </div>
                    {epgNow ? (
                      <div className="space-y-1.5">
                        <p className="text-sm font-bold">{epgNow.title}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${epgNow.progress || 0}%` }} /></div>
                          <span className="text-xs text-muted-foreground tabular-nums">{epgNow.progress || 0}%</span>
                        </div>
                        {epgNow.desc && <p className="text-xs text-muted-foreground/70 line-clamp-2">{epgNow.desc}</p>}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">{epgLoading ? 'Loading…' : 'No EPG data.'}</p>}
                  </div>
                  {/* Channel info + actions */}
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-primary border-primary/40 gap-1"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>LIVE</Badge>
                        {currentChannel.countryCode && flagForCountry(currentChannel.countryCode) && <Badge variant="secondary" className="text-xs gap-1">{flagForCountry(currentChannel.countryCode)} {currentChannel.countryCode.toUpperCase()}</Badge>}
                        {currentChannel.quality && <Badge variant="secondary" className="text-xs">{currentChannel.quality}</Badge>}
                        {currentChannel.group && <Badge variant="secondary" className="text-xs">{currentChannel.group}</Badge>}
                      </div>
                      <h2 className="text-xl font-bold truncate">{currentChannel.displayName}</h2>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!isEmbedUrl(currentChannel.url) && <Button variant="outline" size="sm" onClick={goToPrevChannel} title="Previous (↑)"><ChevronLeft className="w-4 h-4" /></Button>}
                      {!isEmbedUrl(currentChannel.url) && <Button variant="outline" size="sm" onClick={goToNextChannel} title="Next (↓)"><ChevronRight className="w-4 h-4" /></Button>}
                      {!isEmbedUrl(currentChannel.url) && <Button variant={pipActive ? 'default' : 'outline'} size="sm" onClick={togglePiP} title="PiP (P)"><Tv className="w-4 h-4" /></Button>}
                      <Button variant={copiedUrl ? 'default' : 'outline'} size="sm" onClick={() => copyStreamUrl(currentChannel)} title="Copy URL"><Star className="w-4 h-4" /></Button>
                      {isDead(currentChannel) ? <Button variant="outline" size="sm" onClick={() => unmarkDead(currentChannel)}><RotateCcw className="w-4 h-4" /></Button> : <Button variant="outline" size="sm" onClick={() => markDead(currentChannel)}><ZapOff className="w-4 h-4" /></Button>}
                      <Button variant={isFav(currentChannel) ? 'default' : 'outline'} size="sm" onClick={() => toggleFav(currentChannel)}><Heart className={cn('w-4 h-4', isFav(currentChannel) && 'fill-current')} /></Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="aspect-video rounded-xl bg-card flex items-center justify-center"><EmptyState type="source" /></div>
              )}
            </section>

            {/* Channel list */}
            <section className="lg:w-1/3 xl:w-1/4 border-t lg:border-t-0 lg:border-l border-white/5 bg-sidebar/50">
              <div className="p-4 border-b border-white/5 sticky top-0 bg-card/80 backdrop-blur z-10 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground truncate">{showFavsOnly ? 'Favorites' : showRecentOnly ? 'Recent' : activeGroup === '__all' ? 'All Channels' : activeGroup}</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => setListView('grid')} className={cn('p-1.5 rounded', listView === 'grid' ? 'bg-white/10' : 'hover:bg-white/5')}><LayoutGrid className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setListView('list')} className={cn('p-1.5 rounded', listView === 'list' ? 'bg-white/10' : 'hover:bg-white/5')}><List className="w-3.5 h-3.5" /></button>
                  <Badge variant="secondary" className="text-xs ml-1">{filteredChannels.length}</Badge>
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-10rem)] thin-scroll">
                {error ? <EmptyState type="network" action={{ label: 'Retry', onClick: () => fetchPlaylist() }} />
                : loading ? <div className="p-3 space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 shimmer rounded-xl" />)}</div>
                : filteredChannels.length === 0 ? <EmptyState type="search" />
                : listView === 'grid' ? (
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {filteredChannels.slice(0, 200).map(ch => <ChannelCard key={ch.id} channel={ch} active={currentChannel?.url === ch.url} fav={favorites.has(ch.url)} dead={deadChannels.has(ch.url)} recent={recentSet.has(ch.url)} onSelect={() => handleSelectChannel(ch)} onToggleFav={() => toggleFav(ch)} />)}
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    {filteredChannels.slice(0, 500).map(ch => <ChannelRow key={ch.id} channel={ch} active={currentChannel?.url === ch.url} fav={isFav(ch)} dead={isDead(ch)} recent={recentSet.has(ch.url)} onSelect={() => handleSelectChannel(ch)} onToggleFav={() => toggleFav(ch)} onMarkDead={() => markDead(ch)} onUnmarkDead={() => unmarkDead(ch)} />)}
                    {filteredChannels.length > 500 && <p className="p-3 text-center text-xs text-muted-foreground">Showing 500 of {filteredChannels.length.toLocaleString()}</p>}
                  </div>
                )}
              </ScrollArea>
            </section>
          </main>
        </div>
      )}

      {/* ═══ GUIDE VIEW ═══ */}
      {view === 'guide' && (
        <div className="flex-1 overflow-y-auto thin-scroll page-enter">
          <div className="max-w-7xl mx-auto p-4 md:p-6">
            <h2 className="text-2xl font-bold mb-4">TV Guide</h2>
            {guideGenres.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
                {guideGenres.map((g: any) => <button key={g.id} onClick={() => setActiveGuideGenre(g.id)} className={cn('px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap', activeGuideGenre === g.id ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10')}><span className="mr-1">{g.flag}</span>{g.name}</button>)}
              </div>
            )}
            {guideLoading ? <LoadingState /> : (() => {
              const ag = guideGenres.find((g: any) => g.id === activeGuideGenre)
              const channels = ag?.channels || []
              return channels.length === 0 ? <EmptyState type="channels" /> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {channels.map((ch: any, i: number) => (
                    <ChannelCard key={i} channel={{ id: `guide-${i}`, name: ch.name, displayName: ch.displayName, url: ch.url, logo: ch.logo, group: ch.group || ag?.name, quality: ch.quality, isVod: ch.isVod }} active={currentChannel?.url === ch.url} fav={favorites.has(ch.url)} dead={false} recent={false} onSelect={() => handleSelectChannel({ id: `guide-${i}`, name: ch.name, displayName: ch.displayName, url: ch.url, logo: ch.logo, group: ch.group, quality: ch.quality, isVod: ch.isVod })} onToggleFav={() => toggleFav({ id: `guide-${i}`, name: ch.name, displayName: ch.displayName, url: ch.url } as Channel)} />
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ═══ More Drawer ═══ */}
      {showMoreDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowMoreDrawer(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-elevated border-l border-white/5 p-4 overflow-y-auto thin-scroll" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold">More Tools</h3><button onClick={() => setShowMoreDrawer(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4" /></button></div>
            <div className="space-y-1">
              {[
                { icon: Search, label: 'Global Search', desc: 'Search 8000+ channels', fn: () => { setGlobalSearchOpen(true); setShowMoreDrawer(false) } },
                { icon: Grid3x3, label: 'Multi-View', desc: 'Watch multiple channels', fn: () => { setShowMultiView(true); setShowMoreDrawer(false) } },
                { icon: Circle, label: 'DVR Recordings', desc: 'Record & manage', fn: () => { setShowDVR(true); setShowMoreDrawer(false) } },
                { icon: Cloud, label: 'Cloud Sync', desc: 'Sync across devices', fn: () => { setShowSync(true); setShowMoreDrawer(false) } },
                { icon: RefreshCw, label: 'Refresh', desc: 'Pull latest channels', fn: () => { setRefreshNonce(n => n + 1); setShowMoreDrawer(false) } },
                { icon: Tv, label: 'Admin Panel', desc: 'Add channels, XC, Stalker', fn: () => { setShowAdmin(true); setShowMoreDrawer(false) } },
                { icon: Settings, label: 'Settings', desc: 'Filters, quality', fn: () => { setShowSettings(true); setShowMoreDrawer(false) } },
              ].map(item => (
                <button key={item.label} onClick={item.fn} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-left">
                  <item.icon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
              <a href="/download/FreeStreamTV.apk" download className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-left"><Smartphone className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium text-primary">Android App</p><p className="text-xs text-muted-foreground">36,000+ channels</p></div></a>
              <button onClick={() => { setLanguage(l => l === 'en' ? 'ar' : 'en'); setShowMoreDrawer(false) }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-left"><Globe className="w-5 h-5 text-muted-foreground" /><div><p className="text-sm font-medium">{language === 'en' ? 'العربية' : 'English'}</p><p className="text-xs text-muted-foreground">Switch language</p></div></button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Settings Panel ═══ */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[10vh] p-4" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-2xl bg-elevated rounded-2xl border border-white/5 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/5"><h3 className="text-sm font-bold">Settings</h3><button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 max-h-[70vh] overflow-y-auto thin-scroll">
              <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.03]"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /><div><p className="text-sm font-medium">Auto-skip dead</p><p className="text-xs text-muted-foreground">Skip on error</p></div></div><Switch checked={autoSkip} onCheckedChange={setAutoSkip} /></label>
              <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.03]"><div className="flex items-center gap-2"><EyeOff className="w-4 h-4 text-primary" /><div><p className="text-sm font-medium">Hide dead</p><p className="text-xs text-muted-foreground">{deadChannels.size} marked</p></div></div><Switch checked={hideDead} onCheckedChange={setHideDead} /></label>
              <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.03]"><div className="flex items-center gap-2"><Flame className="w-4 h-4 text-primary" /><div><p className="text-sm font-medium">Max quality</p><p className="text-xs text-muted-foreground">Cap stream quality</p></div></div><Select value={maxQuality} onValueChange={(v: any) => setMaxQuality(v)}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto</SelectItem><SelectItem value="480p">480p</SelectItem><SelectItem value="720p">720p</SelectItem><SelectItem value="1080p">1080p</SelectItem></SelectContent></Select></label>
              {deadChannels.size > 0 && <button onClick={() => setDeadChannels(new Set())} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/5 text-sm"><RotateCcw className="w-4 h-4" />Reset dead ({deadChannels.size})</button>}
              <div className="sm:col-span-2 px-4 py-3 rounded-xl bg-white/[0.03] space-y-2">
                <div className="flex items-center gap-2"><Code className="w-4 h-4 text-primary" /><p className="text-sm font-medium">Filter expression</p></div>
                <Input placeholder='Name ~ ".*NBA.*" AND NOT Group ~ ".*XXX.*"' value={filterExpr} onChange={e => setFilterExpr(e.target.value)} className="font-mono text-xs bg-background/60" />
                {filterError && <p className="text-xs text-destructive">⚠ {filterError}</p>}
                <div className="flex flex-wrap gap-1">{[{l:'News',e:'Group ~ ".*News.*"'},{l:'Sports',e:'Group ~ ".*Sport.*"'},{l:'Movies',e:'Group ~ ".*Movi.*"'},{l:'HD',e:'Quality ~ "(1080|720|4K)"'},{l:'No XXX',e:'NOT (Group ~ ".*XXX.*")'},{l:'Clear',e:''}].map(p => <button key={p.l} onClick={() => setFilterExpr(p.e)} className="px-2 py-0.5 rounded-full bg-white/5 text-xs hover:bg-primary hover:text-white">{p.l}</button>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Admin Panel ═══ */}
      {showAdmin && <AdminPanel showAdmin={showAdmin} setShowAdmin={setShowAdmin} adminTab={adminTab} setAdminTab={setAdminTab} customChannels={customChannels} setCustomChannels={setCustomChannels} customM3uUrl={customM3uUrl} setCustomM3uUrl={setCustomM3uUrl} loadCustomM3u={loadCustomM3u} adminChannelName={adminChannelName} setAdminChannelName={setAdminChannelName} adminChannelUrl={adminChannelUrl} setAdminChannelUrl={setAdminChannelUrl} adminChannelLogo={adminChannelLogo} setAdminChannelLogo={setAdminChannelLogo} adminChannelGroup={adminChannelGroup} setAdminChannelGroup={setAdminChannelGroup} addCustomChannel={addCustomChannel} handleSelectChannel={handleSelectChannel} deleteCustomChannel={(id: string) => setCustomChannels(prev => prev.filter(c => c.id !== id))} xcServer={xcServer} setXcServer={setXcServer} xcUser={xcUser} setXcUser={setXcUser} xcPass={xcPass} setXcPass={setXcPass} xcCreds={xcCreds} xcStatus={xcStatus} xcMessage={xcMessage} handleXtreamLogin={handleXtreamLogin} handleXtreamDemo={handleXtreamDemo} stalkerUrl={stalkerUrl} setStalkerUrl={setStalkerUrl} stalkerMac={stalkerMac} setStalkerMac={setStalkerMac} stalkerCreds={stalkerCreds} stalkerStatus={stalkerStatus} stalkerMessage={stalkerMessage} handleStalkerLogin={handleStalkerLogin} twitchInput={twitchInput} setTwitchInput={setTwitchInput} addTwitchChannel={addTwitchChannel} ytLiveInput={ytLiveInput} setYtLiveInput={setYtLiveInput} ytVodInput={ytVodInput} setYtVodInput={setYtVodInput} addYtLiveChannel={addYtLiveChannel} addYtVodChannel={addYtVodChannel} />}

      {/* ═══ Modals ═══ */}
      {showMultiView && <MultiView channels={filteredChannels} onClose={() => setShowMultiView(false)} onSelectChannel={(ch) => handleSelectChannel(ch)} />}
      {showDVR && <DVRPanel currentChannel={currentChannel} onClose={() => setShowDVR(false)} onPlayRecording={(rec) => { handleSelectChannel({ id: rec.id, name: rec.name, displayName: rec.name, rawName: rec.name, url: `/api/dvr?id=${rec.id}&download=1`, group: 'DVR' }); setShowDVR(false) }} />}
      {showSync && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowSync(false)}>
          <div className="w-full max-w-md bg-elevated rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold flex items-center gap-2"><Cloud className="w-4 h-4 text-primary" />Cloud Sync</h3><button onClick={() => setShowSync(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4" /></button></div>
            <p className="text-xs text-muted-foreground mb-4">Sync favorites, recent, and custom channels across devices.</p>
            <div className="space-y-3">
              <Input placeholder="No key — click Generate" value={syncKey} onChange={e => { setSyncKey(e.target.value); localStorage.setItem('freestream.syncKey', e.target.value) }} className="font-mono text-xs" />
              <div className="flex gap-2">
                {!syncKey && <Button onClick={handleSyncCreate} size="sm" className="gap-2" disabled={syncStatus === 'syncing'}>{syncStatus === 'syncing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}Generate</Button>}
                {syncKey && <><Button onClick={handleSyncPush} size="sm" className="gap-2" disabled={syncStatus === 'syncing'}><Cloud className="w-3 h-3" />Push</Button><Button onClick={handleSyncPull} size="sm" variant="outline" className="gap-2" disabled={syncStatus === 'syncing'}><Download className="w-3 h-3" />Pull</Button></>}
              </div>
              {syncStatus === 'ok' && <p className="text-xs text-green-500">✓ Synced!</p>}
              {syncStatus === 'error' && <p className="text-xs text-destructive">✗ Failed</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Global Search ═══ */}
      {globalSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[10vh] p-4" onClick={() => setGlobalSearchOpen(false)}>
          <div className="w-full max-w-2xl bg-elevated rounded-2xl border border-white/5 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-4 border-b border-white/5">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input autoFocus type="text" placeholder="Search 8000+ channels…" value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
              {globalSearching && <Loader2 className="w-4 h-4 animate-spin" />}
              <kbd className="text-xs text-muted-foreground px-2 py-1 rounded bg-white/5">Esc</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto thin-scroll">
              {globalSearchResults.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">{globalSearchQuery.trim().length < 2 ? 'Type 2+ chars to search' : globalSearching ? 'Searching…' : 'No results'}</div> : (
                <div className="divide-y divide-white/5">
                  {globalSearchResults.map(ch => <button key={ch.id} onClick={() => { handleSelectChannel(ch); setGlobalSearchOpen(false); setGlobalSearchQuery(''); setGlobalSearchResults([]) }} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 text-left">
                    {ch.logo ? <img src={ch.logo} alt="" className="w-10 h-10 rounded object-contain bg-white/5" /> : <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{ch.displayName}</p><p className="text-xs text-muted-foreground truncate">{ch.group}</p></div>
                  </button>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Drag-drop overlay ═══ */}
      {showUploadDropzone && <div className="fixed inset-0 z-[60] bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none border-4 border-dashed border-primary m-4 rounded-2xl"><div className="text-center"><Play className="w-16 h-16 text-primary mx-auto mb-4" /><p className="text-xl font-bold text-primary">Drop .m3u file</p></div></div>}

      {/* ═══ Keyboard help ═══ */}
      <KeyboardHelp />
    </div>
  )
}

// ═══ Sub-components ═══

function KeyboardHelp() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === '?' && !(e.target as HTMLElement).matches('input, textarea')) { e.preventDefault(); setShow(s => !s) } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={() => setShow(false)}>
      <div className="w-full max-w-md bg-elevated rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold">Keyboard Shortcuts</h3><button onClick={() => setShow(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4" /></button></div>
        <div className="space-y-2 text-xs">
          {[['Ctrl+K','Global search'],['↑ / ↓','Prev / next channel'],['1-9, 0','Jump to channel'],['Space','Play / pause'],['F','Fullscreen'],['P','Picture-in-Picture'],['?','Toggle help'],['Esc','Close overlay']].map(([k, d]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-1"><kbd className="px-2 py-1 rounded bg-white/5 font-mono">{k}</kbd><span className="text-muted-foreground">{d}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChannelRow({ channel, active, fav, dead, recent, onSelect, onToggleFav, onMarkDead, onUnmarkDead }: { channel: Channel; active: boolean; fav: boolean; dead: boolean; recent: boolean; onSelect: () => void; onToggleFav: () => void; onMarkDead: () => void; onUnmarkDead: () => void }) {
  const flag = channel.countryCode ? flagForCountry(channel.countryCode) : undefined
  return (
    <div className={cn('group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer card-hover', active ? 'bg-gradient-to-r from-primary/20 to-primary/5 ring-1 ring-primary/40' : 'hover:bg-white/5', dead && 'opacity-40')} onClick={onSelect}>
      <div className={cn('w-12 h-12 shrink-0 rounded-xl overflow-hidden flex items-center justify-center relative', active ? 'bg-primary/20' : 'bg-white/5')}>
        {channel.logo ? <img src={channel.logo} alt={channel.displayName} className="w-full h-full object-contain p-0.5" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : <Tv className="w-5 h-5 text-muted-foreground" />}
        {dead && <div className="absolute inset-0 flex items-center justify-center bg-black/70"><ZapOff className="w-4 h-4 text-destructive" /></div>}
        {active && <div className="absolute inset-0 ring-2 ring-primary/50 rounded-xl" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {flag && <span className="text-sm shrink-0">{flag}</span>}
          <p className={cn('text-sm font-semibold truncate', active ? 'text-primary' : 'group-hover:text-white', dead && 'line-through')}>{channel.displayName}</p>
          {fav && <Heart className="w-3 h-3 text-primary fill-current shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {channel.quality && <span className="text-[9px] font-bold px-1.5 rounded bg-white/10 uppercase">{channel.quality}</span>}
          {channel.isVod && <span className="text-[9px] font-bold px-1.5 rounded bg-blue-500/20 text-blue-400">VOD</span>}
          {recent && !fav && <Clock className="w-3 h-3 text-primary/60" />}
          <span className="text-xs text-muted-foreground/60 truncate">{channel.group}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {dead ? <button onClick={(e) => { e.stopPropagation(); onUnmarkDead() }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary"><RotateCcw className="w-4 h-4" /></button> : <button onClick={(e) => { e.stopPropagation(); onMarkDead() }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"><ZapOff className="w-4 h-4" /></button>}
        <button onClick={(e) => { e.stopPropagation(); onToggleFav() }} className={cn('p-1.5 rounded-lg', fav ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}><Heart className={cn('w-4 h-4', fav && 'fill-current')} /></button>
      </div>
    </div>
  )
}

// ═══ Admin Panel (inline to preserve all handlers) ═══
function AdminPanel(props: any) {
  const { showAdmin, setShowAdmin, adminTab, setAdminTab, customChannels, customM3uUrl, setCustomM3uUrl, loadCustomM3u, adminChannelName, setAdminChannelName, adminChannelUrl, setAdminChannelUrl, adminChannelLogo, setAdminChannelLogo, adminChannelGroup, setAdminChannelGroup, addCustomChannel, handleSelectChannel, deleteCustomChannel, xcServer, setXcServer, xcUser, setXcUser, xcPass, setXcPass, xcCreds, xcStatus, xcMessage, handleXtreamLogin, handleXtreamDemo, stalkerUrl, setStalkerUrl, stalkerMac, setStalkerMac, stalkerCreds, stalkerStatus, stalkerMessage, handleStalkerLogin, twitchInput, setTwitchInput, addTwitchChannel, ytLiveInput, setYtLiveInput, ytVodInput, setYtVodInput, addYtLiveChannel, addYtVodChannel } = props
  if (!showAdmin) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[5vh] p-4" onClick={() => setShowAdmin(false)}>
      <div className="w-full max-w-3xl bg-elevated rounded-2xl border border-white/5 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/5"><h3 className="text-sm font-bold">Admin Panel</h3><button onClick={() => setShowAdmin(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4" /></button></div>
        <div className="flex gap-1 p-2 border-b border-white/5 overflow-x-auto no-scrollbar">
          {(['channels', 'xtream', 'stalker', 'embed'] as const).map(t => <button key={t} onClick={() => setAdminTab(t)} className={cn('px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap', adminTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{t === 'channels' ? `Channels (${customChannels?.length || 0})` : t === 'xtream' ? 'Xtream' : t === 'stalker' ? 'Stalker' : 'Twitch & YT'}</button>)}
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-3">
          {adminTab === 'channels' && (<>
            <div className="flex gap-2"><Input placeholder="Paste M3U URL" value={customM3uUrl} onChange={(e: any) => setCustomM3uUrl(e.target.value)} className="bg-white/5 flex-1" /><Button onClick={loadCustomM3u} size="sm"><Search className="w-3 h-3" />Load</Button></div>
            <label className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/8 cursor-pointer text-sm border border-dashed border-white/10"><input type="file" accept=".m3u,.m3u8" className="hidden" onChange={(e: any) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = (ev) => { const t = ev.target?.result as string; if (!t) return; const b = new Blob([t], { type: 'audio/mpegurl' }); const u = URL.createObjectURL(b); fetch(`/api/playlist?url=${encodeURIComponent(u)}&refresh=1`).then(rr => rr.json()).then(j => { const chs = (j.channels || []).map((ch: any, i: number) => ({ ...ch, id: `upload-${Date.now()}-${i}`, group: ch.group || f.name.replace(/\.m3u8?$/i, '') })); props.setCustomChannels((prev: any) => [...chs, ...prev]); URL.revokeObjectURL(u) }) }; reader.readAsText(f) }} /><Play className="w-3 h-3" />Upload .m3u</label>
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Channel name" value={adminChannelName} onChange={(e: any) => setAdminChannelName(e.target.value)} className="bg-white/5" /><Input placeholder="Stream URL" value={adminChannelUrl} onChange={(e: any) => setAdminChannelUrl(e.target.value)} className="bg-white/5" /><Input placeholder="Logo URL" value={adminChannelLogo} onChange={(e: any) => setAdminChannelLogo(e.target.value)} className="bg-white/5" /><Input placeholder="Group" value={adminChannelGroup} onChange={(e: any) => setAdminChannelGroup(e.target.value)} className="bg-white/5" /></div>
            <Button onClick={addCustomChannel} size="sm"><Plus className="w-3 h-3" />Add Channel</Button>
            {customChannels?.length > 0 && <div className="space-y-1 mt-2 max-h-40 overflow-y-auto thin-scroll">{customChannels.map((ch: Channel) => <div key={ch.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03]">{ch.logo ? <img src={ch.logo} alt="" className="w-8 h-8 rounded object-contain" /> : <Tv className="w-5 h-5 text-muted-foreground" />}<span className="text-sm font-medium flex-1 truncate">{ch.displayName}</span><button onClick={() => { handleSelectChannel(ch); setShowAdmin(false) }} className="px-2 py-1 rounded text-xs bg-primary/20 text-primary">Play</button><button onClick={() => deleteCustomChannel(ch.id)} className="p-1 rounded hover:bg-destructive/20"><X className="w-4 h-4" /></button></div>)}</div>}
          </>)}
          {adminTab === 'xtream' && (<>
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-3"><div className="flex-1"><p className="text-sm font-bold text-primary">Try Demo (no server needed)</p><p className="text-xs text-muted-foreground">16 real channels + 5 VOD</p></div><Button onClick={handleXtreamDemo} size="sm" disabled={xcStatus === 'loading'}>{xcStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}Demo</Button></div>
            <div className="grid grid-cols-3 gap-2"><Input placeholder="Server URL" value={xcServer} onChange={(e: any) => setXcServer(e.target.value)} className="bg-white/5 col-span-3 font-mono text-xs" /><Input placeholder="Username" value={xcUser} onChange={(e: any) => setXcUser(e.target.value)} className="bg-white/5" /><Input placeholder="Password" type="password" value={xcPass} onChange={(e: any) => setXcPass(e.target.value)} className="bg-white/5" /></div>
            <div className="flex gap-2"><Button onClick={handleXtreamLogin} size="sm" disabled={xcStatus === 'loading'}>{xcStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}Connect</Button>{xcCreds && <Button onClick={() => { clearXtreamCreds(); props.setXcCreds?.(null); props.setXcStatus?.('idle'); props.setXcMessage?.('Logged out') }} size="sm" variant="outline">Logout</Button>}</div>
            {xcMessage && <p className={cn('text-xs p-2 rounded-lg', xcStatus === 'ok' && 'bg-green-500/10 text-green-500', xcStatus === 'error' && 'bg-destructive/10 text-destructive')}>{xcMessage}</p>}
          </>)}
          {adminTab === 'stalker' && (<>
            <p className="text-xs text-muted-foreground">Login to a Stalker/Ministra portal using MAC address.</p>
            <div className="grid grid-cols-3 gap-2"><Input placeholder="Portal URL" value={stalkerUrl} onChange={(e: any) => setStalkerUrl(e.target.value)} className="bg-white/5 col-span-3 font-mono text-xs" /><Input placeholder="MAC (00:1A:79:XX:XX:XX)" value={stalkerMac} onChange={(e: any) => setStalkerMac(e.target.value)} className="bg-white/5 col-span-3 font-mono text-xs" /></div>
            <div className="flex gap-2"><Button onClick={handleStalkerLogin} size="sm" disabled={stalkerStatus === 'loading'}>{stalkerStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}Connect</Button></div>
            {stalkerMessage && <p className={cn('text-xs p-2 rounded-lg', stalkerStatus === 'ok' && 'bg-green-500/10 text-green-500', stalkerStatus === 'error' && 'bg-destructive/10 text-destructive')}>{stalkerMessage}</p>}
          </>)}
          {adminTab === 'embed' && (<>
            <div className="flex gap-2"><div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-xs font-mono shrink-0"><Twitch className="w-3.5 h-3.5 text-purple-500" />twitch:</div><Input placeholder="Channel name" value={twitchInput} onChange={(e: any) => setTwitchInput(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter' && twitchInput) addTwitchChannel() }} className="bg-white/5 flex-1" /><Button size="sm" onClick={addTwitchChannel} disabled={!twitchInput}><Plus className="w-3 h-3" />Add</Button></div>
            <div className="flex gap-2"><div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-xs font-mono shrink-0"><Youtube className="w-3.5 h-3.5 text-red-500" />youtube-live:</div><Input placeholder="Channel ID" value={ytLiveInput} onChange={(e: any) => setYtLiveInput(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter' && ytLiveInput) addYtLiveChannel() }} className="bg-white/5 flex-1" /><Button size="sm" onClick={addYtLiveChannel} disabled={!ytLiveInput}><Plus className="w-3 h-3" />Add</Button></div>
            <div className="flex gap-2"><div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-xs font-mono shrink-0"><Youtube className="w-3.5 h-3.5 text-red-500" />youtube:</div><Input placeholder="Video ID" value={ytVodInput} onChange={(e: any) => setYtVodInput(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter' && ytVodInput) addYtVodChannel() }} className="bg-white/5 flex-1" /><Button size="sm" onClick={addYtVodChannel} disabled={!ytVodInput}><Plus className="w-3 h-3" />Add</Button></div>
          </>)}
        </div>
      </div>
    </div>
  )
}
