'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Search, Heart, Tv, Loader2, AlertCircle, Menu, X, Radio,
  Globe, ChevronRight, Star, Zap, Filter,
  ZapOff, EyeOff, Settings, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { VideoPlayer } from '@/components/video-player'
import {
  PLAYLIST_SOURCES, PLAYLIST_CATEGORIES, getSourcesByCategory,
  type PlaylistSource, type PlaylistCategory,
} from '@/lib/playlists'
import type { Channel } from '@/lib/m3u-parser'
import { cn } from '@/lib/utils'

type PlaylistData = {
  channels: Channel[]
  groups: string[]
  totalCount: number
  sourceId: string
}

const FAV_KEY = 'streamdeck.favorites'
const DEAD_KEY = 'streamdeck.deadChannels'
const ACTIVE_SRC_KEY = 'streamdeck.activeSource'
const AUTOSKIP_KEY = 'streamdeck.autoSkip'
const HIDE_DEAD_KEY = 'streamdeck.hideDead'

export default function Home() {
  // Active playlist source — default to Arabic (most reliable per-channel ratio)
  const [activeSource, setActiveSource] = useState<PlaylistSource>(
    PLAYLIST_SOURCES.find(s => s.id === 'arabic') ?? PLAYLIST_SOURCES[0],
  )
  const [activePlaylistCat, setActivePlaylistCat] = useState<PlaylistCategory>('featured')
  const [data, setData] = useState<PlaylistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>('__all')
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [deadChannels, setDeadChannels] = useState<Set<string>>(new Set())
  const [hideDead, setHideDead] = useState(true)
  const [autoSkip, setAutoSkip] = useState(true)
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const favRaw = localStorage.getItem(FAV_KEY)
      if (favRaw) setFavorites(new Set(JSON.parse(favRaw)))
      const deadRaw = localStorage.getItem(DEAD_KEY)
      if (deadRaw) setDeadChannels(new Set(JSON.parse(deadRaw)))
      const last = localStorage.getItem(ACTIVE_SRC_KEY)
      if (last) {
        const src = PLAYLIST_SOURCES.find(p => p.id === last)
        if (src) {
          setActiveSource(src)
          setActivePlaylistCat(src.category)
        }
      }
      const as = localStorage.getItem(AUTOSKIP_KEY)
      if (as !== null) setAutoSkip(as === '1')
      const hd = localStorage.getItem(HIDE_DEAD_KEY)
      if (hd !== null) setHideDead(hd === '1')
    } catch {}
  }, [])

  // Fetch playlist data
  const fetchPlaylist = useCallback(async (source: PlaylistSource) => {
    setLoading(true)
    setError(null)
    setData(null)
    setActiveGroup('__all')
    setSearch('')
    try {
      const res = await fetch(`/api/playlist?source=${encodeURIComponent(source.id)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load playlist')
      setData(json)
      // Pick first non-dead channel as initial preview
      const firstPlayable = (json.channels as Channel[]).find(c => !deadChannels.has(c.url))
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
  }, [deadChannels])

  useEffect(() => {
    fetchPlaylist(activeSource)
    try { localStorage.setItem(ACTIVE_SRC_KEY, activeSource.id) } catch {}
  }, [activeSource, fetchPlaylist])

  // Persist favorites
  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favorites))) } catch {}
  }, [favorites])

  // Persist dead channels
  useEffect(() => {
    try { localStorage.setItem(DEAD_KEY, JSON.stringify(Array.from(deadChannels))) } catch {}
  }, [deadChannels])

  // Persist settings
  useEffect(() => {
    try { localStorage.setItem(AUTOSKIP_KEY, autoSkip ? '1' : '0') } catch {}
  }, [autoSkip])
  useEffect(() => {
    try { localStorage.setItem(HIDE_DEAD_KEY, hideDead ? '1' : '0') } catch {}
  }, [hideDead])

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

  // Auto-skip to next channel
  const goToNextChannel = useCallback(() => {
    if (!data || !currentChannel) return
    const list = filteredChannelsRef.current
    const idx = list.findIndex(c => c.url === currentChannel.url)
    // Find next non-dead channel
    for (let i = idx + 1; i < list.length; i++) {
      const next = list[i]
      if (!deadChannels.has(next.url)) {
        setCurrentChannel(next)
        return
      }
    }
    // Wrap around
    for (let i = 0; i < idx; i++) {
      const next = list[i]
      if (!deadChannels.has(next.url)) {
        setCurrentChannel(next)
        return
      }
    }
  }, [data, currentChannel, deadChannels])

  // Filtered channels based on search + group + favorites + dead
  const filteredChannels = useMemo(() => {
    if (!data) return []
    let list = data.channels
    if (showFavsOnly) {
      list = list.filter(c => favorites.has(c.url))
    }
    if (activeGroup !== '__all') {
      list = list.filter(c => c.group === activeGroup)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.group || '').toLowerCase().includes(q) ||
        (c.country || '').toLowerCase().includes(q)
      )
    }
    if (hideDead) {
      list = list.filter(c => !deadChannels.has(c.url))
    }
    return list
  }, [data, search, activeGroup, showFavsOnly, favorites, deadChannels, hideDead])

  // Keep a ref so goToNextChannel can access latest filtered list
  const filteredChannelsRef = useRef<Channel[]>([])
  useEffect(() => {
    filteredChannelsRef.current = filteredChannels
  }, [filteredChannels])

  // When the player errors out, mark the channel as dead
  const handlePlayerError = useCallback((_msg: string) => {
    if (currentChannel) {
      markDead(currentChannel)
    }
  }, [currentChannel, markDead])

  // Group counts (respecting current filters except group)
  const groupCounts = useMemo(() => {
    if (!data) return new Map<string, number>()
    const m = new Map<string, number>()
    let list = data.channels
    if (showFavsOnly) list = list.filter(c => favorites.has(c.url))
    if (hideDead) list = list.filter(c => !deadChannels.has(c.url))
    for (const c of list) {
      const g = c.group || 'Other'
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [data, showFavsOnly, favorites, deadChannels, hideDead])

  const playlistsForActiveCat = useMemo(
    () => getSourcesByCategory(activePlaylistCat),
    [activePlaylistCat],
  )

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
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
              <h1 className="text-lg font-bold tracking-tight">StreamDeck</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">M3U Playlist Player</p>
            </div>
          </div>

          <div className="flex-1 max-w-xl mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search channels, groups, countries…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/60 border-border focus-visible:bg-secondary"
            />
          </div>

          <Button
            variant={showFavsOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavsOnly(v => !v)}
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

        {/* Settings panel */}
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
                    <p className="text-xs text-muted-foreground">
                      Hide {deadChannels.size} marked-dead streams
                    </p>
                  </div>
                </div>
                <Switch checked={hideDead} onCheckedChange={setHideDead} />
              </label>

              {deadChannels.size > 0 && (
                <button
                  onClick={() => setDeadChannels(new Set())}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition text-sm sm:col-span-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset dead channel list ({deadChannels.size} channels)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Playlist category selector */}
        <div className="px-4 md:px-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {PLAYLIST_CATEGORIES.map(cat => {
            const count = PLAYLIST_SOURCES.filter(s => s.category === cat.id).length
            return (
              <button
                key={cat.id}
                onClick={() => setActivePlaylistCat(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap text-xs font-medium transition',
                  activePlaylistCat === cat.id
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{cat.flag}</span>
                <span>{cat.label}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Playlist source selector (for active category) */}
        <div className="px-4 md:px-6 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {playlistsForActiveCat.map(src => (
            <button
              key={src.id}
              onClick={() => setActiveSource(src)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap text-sm font-medium transition border',
                activeSource.id === src.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30'
                  : 'bg-secondary/50 text-foreground hover:bg-secondary border-transparent',
              )}
            >
              <span>{src.flag}</span>
              <span>{src.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex relative">
        {/* Sidebar — groups */}
        <aside
          className={cn(
            'absolute lg:static inset-y-0 left-0 z-20 w-64 bg-sidebar border-r border-border transition-transform duration-200',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Categories
              </h2>
            </div>
            {data && (
              <p className="text-xs text-muted-foreground">
                {data.totalCount.toLocaleString()} channels · {data.groups.length} groups
                {deadChannels.size > 0 && (
                  <span className="text-primary/80"> · {deadChannels.size} dead</span>
                )}
              </p>
            )}
          </div>

          <ScrollArea className="h-[calc(100vh-12rem)] thin-scroll">
            <div className="p-2 space-y-0.5">
              <GroupButton
                label="All Channels"
                count={data ? data.totalCount - (hideDead ? deadChannels.size : 0) : 0}
                active={activeGroup === '__all' && !showFavsOnly}
                onClick={() => { setActiveGroup('__all'); setShowFavsOnly(false); setSidebarOpen(false) }}
                icon={<Globe className="w-4 h-4" />}
              />
              <GroupButton
                label="Favorites"
                count={favorites.size}
                active={showFavsOnly}
                onClick={() => { setShowFavsOnly(true); setActiveGroup('__all'); setSidebarOpen(false) }}
                icon={<Star className="w-4 h-4" />}
              />
              <div className="my-2 h-px bg-border" />
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
                      active={activeGroup === group && !showFavsOnly}
                      onClick={() => { setActiveGroup(group); setShowFavsOnly(false); setSidebarOpen(false) }}
                    />
                  ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col lg:flex-row">
          {/* Player + now playing */}
          <section className="lg:w-2/3 xl:w-3/4 p-4 md:p-6 space-y-4">
            {currentChannel ? (
              <>
                <VideoPlayer
                  src={currentChannel.url}
                  poster={currentChannel.logo}
                  channelName={currentChannel.name}
                  onError={handlePlayerError}
                  onNext={goToNextChannel}
                  autoSkip={autoSkip}
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
                      {currentChannel.group && (
                        <Badge variant="secondary" className="text-xs">
                          {currentChannel.group}
                        </Badge>
                      )}
                      {isDead(currentChannel) && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <ZapOff className="w-3 h-3" /> Marked dead
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight truncate">
                      {currentChannel.name}
                    </h2>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {currentChannel.country && <span>{currentChannel.country} · </span>}
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

          {/* Channel list (right side on desktop) */}
          <section className="lg:w-1/3 xl:w-1/4 border-t lg:border-t-0 lg:border-l border-border bg-card/30">
            <div className="p-4 border-b border-border sticky top-0 bg-card/80 backdrop-blur z-10">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {showFavsOnly ? 'Favorites' : activeGroup === '__all' ? 'All Channels' : activeGroup}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPlaylist(activeSource)}
                  >
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
                  {hideDead && deadChannels.size > 0 && (
                    <button
                      onClick={() => setHideDead(false)}
                      className="mt-3 text-xs text-primary hover:underline"
                    >
                      Show {deadChannels.size} hidden dead channels
                    </button>
                  )}
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
                      onSelect={() => {
                        setCurrentChannel(channel)
                        if (typeof window !== 'undefined') {
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }
                      }}
                      onToggleFav={() => toggleFav(channel)}
                      onMarkDead={() => markDead(channel)}
                      onUnmarkDead={() => unmarkDead(channel)}
                    />
                  ))}
                  {filteredChannels.length > 500 && (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      Showing first 500 of {filteredChannels.length.toLocaleString()} channels — refine your search to see more.
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

/* ----- helpers ----- */

/* ----- Sub-components ----- */

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
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'hover:bg-secondary text-foreground/90',
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
  channel, active, fav, dead, onSelect, onToggleFav, onMarkDead, onUnmarkDead,
}: {
  channel: Channel
  active: boolean
  fav: boolean
  dead: boolean
  onSelect: () => void
  onToggleFav: () => void
  onMarkDead: () => void
  onUnmarkDead: () => void
}) {
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
            alt={channel.name}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
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
        <p className={cn('text-sm font-medium truncate', active ? 'text-primary' : dead && 'line-through')}>
          {channel.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{channel.group}</p>
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
