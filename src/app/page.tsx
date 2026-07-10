'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Search, Heart, Tv, Loader2, AlertCircle, Menu, X, Radio,
  Globe, ChevronRight, Star, Zap, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { VideoPlayer } from '@/components/video-player'
import { PLAYLIST_SOURCES, type PlaylistSource } from '@/lib/playlists'
import type { Channel } from '@/lib/m3u-parser'
import { cn } from '@/lib/utils'

type PlaylistData = {
  channels: Channel[]
  groups: string[]
  totalCount: number
  sourceId: string
}

const FAV_KEY = 'streamdeck.favorites'
const ACTIVE_SRC_KEY = 'streamdeck.activeSource'

export default function Home() {
  const [activeSource, setActiveSource] = useState<PlaylistSource>(PLAYLIST_SOURCES[0])
  const [data, setData] = useState<PlaylistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>('__all')
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        setFavorites(new Set(arr))
      }
    } catch {}
    // Restore last source
    try {
      const last = localStorage.getItem(ACTIVE_SRC_KEY)
      if (last) {
        const src = PLAYLIST_SOURCES.find(p => p.id === last)
        if (src) setActiveSource(src)
      }
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
      // Pick first channel as initial preview
      if (json.channels && json.channels.length > 0) {
        setCurrentChannel(json.channels[0])
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlaylist(activeSource)
    try { localStorage.setItem(ACTIVE_SRC_KEY, activeSource.id) } catch {}
  }, [activeSource, fetchPlaylist])

  // Persist favorites
  useEffect(() => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favorites)))
    } catch {}
  }, [favorites])

  const toggleFav = useCallback((channel: Channel) => {
    setFavorites(prev => {
      const next = new Set(prev)
      // Use URL as identifier since IDs may differ across loads
      const key = channel.url
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const isFav = useCallback((channel: Channel) => favorites.has(channel.url), [favorites])

  // Filtered channels based on search + group + favorites
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
    return list
  }, [data, search, activeGroup, showFavsOnly, favorites])

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
        </div>

        {/* Playlist source selector */}
        <div className="px-4 md:px-6 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {PLAYLIST_SOURCES.map(src => (
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
              </p>
            )}
          </div>

          <ScrollArea className="h-[calc(100vh-9rem)] thin-scroll">
            <div className="p-2 space-y-0.5">
              <GroupButton
                label="All Channels"
                count={data?.totalCount ?? 0}
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
                data?.groups.map(group => {
                  const count = data.channels.filter(c => c.group === group).length
                  return (
                    <GroupButton
                      key={group}
                      label={group}
                      count={count}
                      active={activeGroup === group && !showFavsOnly}
                      onClick={() => { setActiveGroup(group); setShowFavsOnly(false); setSidebarOpen(false) }}
                    />
                  )
                })
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
                />
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
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
                  <Button
                    variant={isFav(currentChannel) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleFav(currentChannel)}
                    className="gap-2 shrink-0"
                  >
                    <Heart className={cn('w-4 h-4', isFav(currentChannel) && 'fill-current')} />
                    <span className="hidden sm:inline">
                      {isFav(currentChannel) ? 'Saved' : 'Save'}
                    </span>
                  </Button>
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

            <ScrollArea className="h-[calc(100vh-9rem)] thin-scroll">
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
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {filteredChannels.slice(0, 500).map(channel => (
                    <ChannelRow
                      key={channel.id}
                      channel={channel}
                      active={currentChannel?.url === channel.url}
                      fav={isFav(channel)}
                      onSelect={() => {
                        setCurrentChannel(channel)
                        if (typeof window !== 'undefined') {
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }
                      }}
                      onToggleFav={() => toggleFav(channel)}
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
  channel, active, fav, onSelect, onToggleFav,
}: {
  channel: Channel
  active: boolean
  fav: boolean
  onSelect: () => void
  onToggleFav: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition',
        active ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-secondary',
      )}
      onClick={onSelect}
    >
      <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
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
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', active && 'text-primary')}>
          {channel.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{channel.group}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav() }}
        className={cn(
          'p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition',
          fav && 'opacity-100 text-primary',
          !fav && 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="Toggle favorite"
      >
        <Heart className={cn('w-4 h-4', fav && 'fill-current')} />
      </button>
      {active && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
    </div>
  )
}
