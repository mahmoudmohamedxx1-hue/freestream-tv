'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Search, Heart, Tv, Loader2, AlertCircle, Menu, X, Radio,
  Globe, ChevronRight, Star, Zap, Filter, ZapOff, EyeOff,
  Settings, RotateCcw, Clock, ArrowDownAZ, ArrowUpAZ, Flame,
  CheckCircle2, Calendar, Play, ChevronDown,
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
import { PROVIDERS, type Provider, type ProviderCategory } from '@/lib/playlists'
import type { Channel } from '@/lib/m3u-parser'
import { flagForCountry } from '@/lib/countries'
import { cn } from '@/lib/utils'

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
  const [hideDead, setHideDead] = useState(true)
  const [hideBad, setHideBad] = useState(true)
  const [autoSkip, setAutoSkip] = useState(true)
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('az')
  const [maxQuality, setMaxQuality] = useState<MaxQuality>('auto')
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarView, setSidebarView] = useState<SidebarView>('channels')
  const [tvGuide, setTvGuide] = useState<any[]>([])
  const [guideLoading, setGuideLoading] = useState(false)

  // ─── Refs that mirror state ────────────────────────────────────────────
  const deadChannelsRef = useRef<Set<string>>(new Set())
  const favoritesRef = useRef<Set<string>>(new Set())
  const recentChannelsRef = useRef<string[]>([])
  const currentChannelRef = useRef<Channel | null>(null)
  useEffect(() => { deadChannelsRef.current = deadChannels }, [deadChannels])
  useEffect(() => { favoritesRef.current = favorites }, [favorites])
  useEffect(() => { recentChannelsRef.current = recentChannels }, [recentChannels])
  useEffect(() => { currentChannelRef.current = currentChannel }, [currentChannel])

  // ─── Load persisted state on mount ──────────────────────────────────────
  useEffect(() => {
    try {
      const favRaw = localStorage.getItem(FAV_KEY)
      if (favRaw) setFavorites(new Set(JSON.parse(favRaw)))
      const deadRaw = localStorage.getItem(DEAD_KEY)
      if (deadRaw) setDeadChannels(new Set(JSON.parse(deadRaw)))
      const recentRaw = localStorage.getItem(RECENT_KEY)
      if (recentRaw) setRecentChannels(JSON.parse(recentRaw))
      const as = localStorage.getItem(AUTOSKIP_KEY)
      if (as !== null) setAutoSkip(as === '1')
      const hd = localStorage.getItem(HIDE_DEAD_KEY)
      if (hd !== null) setHideDead(hd === '1')
      const hb = localStorage.getItem(HIDE_BAD_KEY)
      if (hb !== null) setHideBad(hb === '1')
      const mq = localStorage.getItem(MAX_QUALITY_KEY) as MaxQuality | null
      if (mq) setMaxQuality(mq)
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
  const fetchPlaylist = useCallback(async () => {
    if (!activeProvider || !activeCategory) return
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
  }, [activeProvider, activeCategory, activePlaylistId])

  useEffect(() => {
    fetchPlaylist()
  }, [fetchPlaylist])

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

  const handlePlayerError = useCallback((_msg: string) => {
    const cur = currentChannelRef.current
    if (cur) {
      markDead(cur)
    }
  }, [markDead])

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
  }, [data, search, activeGroup, showFavsOnly, showRecentOnly, favorites, deadChannels, hideDead, hideBad, qualityFilter, sortMode, recentChannels, recentSet])

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
              <p className="text-xs text-muted-foreground -mt-0.5">Free live TV — no signup</p>
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(v => !v)}
            className="gap-2"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>

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
            </div>
          </div>
        )}

        {/* ─── Row 1: Provider tabs ─── */}
        <div className="px-4 md:px-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {PROVIDERS.map(prov => (
            <button
              key={prov.id}
              onClick={() => switchProvider(prov)}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap text-sm font-medium transition border',
                activeProvider.id === prov.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30'
                  : 'bg-secondary/50 text-foreground hover:bg-secondary border-transparent',
              )}
            >
              {prov.logo ? (
                <img
                  src={prov.logo}
                  alt={prov.name}
                  className={cn(
                    'w-5 h-5 object-contain',
                    activeProvider.id === prov.id && 'brightness-0 invert',
                  )}
                  onError={(e) => {
                    // Fallback to flag emoji if logo fails to load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent && !parent.querySelector('.fallback-flag')) {
                      const span = document.createElement('span')
                      span.className = 'fallback-flag'
                      span.textContent = prov.flag
                      parent.insertBefore(span, parent.firstChild)
                    }
                  }}
                />
              ) : (
                <span>{prov.flag}</span>
              )}
              <span>{prov.name}</span>
            </button>
          ))}
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
          <section className="lg:w-2/3 xl:w-3/4 p-4 md:p-6 space-y-4">
            {currentChannel ? (
              <>
                <VideoPlayer
                  src={currentChannel.url}
                  poster={currentChannel.logo}
                  channelName={currentChannel.displayName}
                  onError={handlePlayerError}
                  onNext={goToNextChannel}
                  autoSkip={autoSkip}
                  maxQuality={maxQuality}
                />
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
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
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
    </div>
  )
}

/* ─── Sub-components ─── */

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
