'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Channel } from '@/lib/m3u-parser'
import { PROVIDERS, type Provider, type ProviderCategory } from '@/lib/playlists'
import { flagForCountry } from '@/lib/countries'

// ═══ Types ═══
export type View = 'home' | 'live' | 'guide' | 'favorites'
export type ListViewMode = 'grid' | 'list'

// ═══ Library State Hook (favorites, recent, custom channels) ═══
const FAV_KEY = 'freestream.favorites'
const DEAD_KEY = 'freestream.deadChannels'
const RECENT_KEY = 'freestream.recentChannels'
const ACTIVE_PATH_KEY = 'freestream.activePath'
const AUTOSKIP_KEY = 'freestream.autoSkip'
const HIDE_DEAD_KEY = 'freestream.hideDead'
const HIDE_BAD_KEY = 'freestream.hideBad'
const MAX_QUALITY_KEY = 'freestream.maxQuality'
const LANG_KEY = 'freestream.language'
const CUSTOM_KEY = 'freestream.customChannels'

export function useLibraryState() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [recentChannels, setRecentChannels] = useState<string[]>([])
  const [customChannels, setCustomChannels] = useState<Channel[]>([])
  const [deadChannels, setDeadChannels] = useState<Set<string>>(new Set())
  const [language, setLanguage] = useState<'en' | 'ar'>('en')

  useEffect(() => {
    try {
      const favRaw = localStorage.getItem(FAV_KEY)
      if (favRaw) setFavorites(new Set(JSON.parse(favRaw)))
      localStorage.removeItem(DEAD_KEY)
      setDeadChannels(new Set())
      const recentRaw = localStorage.getItem(RECENT_KEY)
      if (recentRaw) setRecentChannels(JSON.parse(recentRaw))
      const customRaw = localStorage.getItem(CUSTOM_KEY)
      if (customRaw) setCustomChannels(JSON.parse(customRaw))
      const savedLang = localStorage.getItem(LANG_KEY) as 'en' | 'ar' | null
      if (savedLang) setLanguage(savedLang)
    } catch {}
  }, [])

  useEffect(() => { try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favorites))) } catch {} }, [favorites])
  useEffect(() => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentChannels)) } catch {} }, [recentChannels])
  useEffect(() => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customChannels)) } catch {} }, [customChannels])
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
    try { localStorage.setItem(LANG_KEY, language) } catch {}
  }, [language])

  const toggleFav = useCallback((channel: Channel) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(channel.url)) next.delete(channel.url)
      else next.add(channel.url)
      return next
    })
  }, [])

  const isFav = useCallback((channel: Channel) => favorites.has(channel.url), [favorites])

  const recordRecent = useCallback((channel: Channel) => {
    setRecentChannels(prev => [channel.url, ...prev.filter(u => u !== channel.url)].slice(0, 20))
  }, [])

  const markDead = useCallback((channel: Channel) => {
    setDeadChannels(prev => { const n = new Set(prev); n.add(channel.url); return n })
  }, [])
  const unmarkDead = useCallback((channel: Channel) => {
    setDeadChannels(prev => { const n = new Set(prev); n.delete(channel.url); return n })
  }, [])
  const isDead = useCallback((channel: Channel) => deadChannels.has(channel.url), [deadChannels])

  return {
    favorites, setFavorites, recentChannels, setRecentChannels,
    customChannels, setCustomChannels, deadChannels, setDeadChannels,
    language, setLanguage,
    toggleFav, isFav, recordRecent, markDead, unmarkDead, isDead,
  }
}

// ═══ Player State Hook ═══
export function usePlayerState() {
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [pipActive, setPipActive] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const selectChannel = useCallback((channel: Channel) => {
    setCurrentChannel(channel)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const copyStreamUrl = useCallback(async (channel: Channel) => {
    try {
      await navigator.clipboard.writeText(channel.url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {}
  }, [])

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
    } catch {}
  }, [])

  return {
    currentChannel, setCurrentChannel: selectChannel,
    pipActive, setPipActive, copiedUrl, copyStreamUrl, togglePiP,
    videoRef,
  }
}

// ═══ Source State Hook ═══
export function useSourceState() {
  const [activeProvider, setActiveProvider] = useState<Provider>(PROVIDERS[0])
  const [activeCategory, setActiveCategory] = useState<ProviderCategory | null>(PROVIDERS[0].categories[0])
  const [activePlaylistId, setActivePlaylistId] = useState<string | undefined>(undefined)

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

  useEffect(() => {
    try {
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

  return {
    activeProvider, setActiveProvider,
    activeCategory, setActiveCategory,
    activePlaylistId, setActivePlaylistId,
    switchProvider, switchCategory,
  }
}

// ═══ Settings State Hook ═══
export function useSettingsState() {
  const [autoSkip, setAutoSkip] = useState(false)
  const [hideDead, setHideDead] = useState(false)
  const [hideBad, setHideBad] = useState(false)
  const [maxQuality, setMaxQuality] = useState<'auto' | '480p' | '720p' | '1080p'>('auto')
  const [filterExpr, setFilterExpr] = useState('')
  const [customUserAgent, setCustomUserAgent] = useState('')

  useEffect(() => {
    try {
      const as = localStorage.getItem(AUTOSKIP_KEY)
      setAutoSkip(as === '1')
      setHideDead(localStorage.getItem(HIDE_DEAD_KEY) === '1')
      setHideBad(localStorage.getItem(HIDE_BAD_KEY) === '1')
      const mq = localStorage.getItem(MAX_QUALITY_KEY) as any
      if (mq) setMaxQuality(mq)
      const ua = localStorage.getItem('freestream.customUserAgent')
      if (ua) setCustomUserAgent(ua)
    } catch {}
  }, [])

  useEffect(() => { try { localStorage.setItem(AUTOSKIP_KEY, autoSkip ? '1' : '0') } catch {} }, [autoSkip])
  useEffect(() => { try { localStorage.setItem(HIDE_DEAD_KEY, hideDead ? '1' : '0') } catch {} }, [hideDead])
  useEffect(() => { try { localStorage.setItem(HIDE_BAD_KEY, hideBad ? '1' : '0') } catch {} }, [hideBad])
  useEffect(() => { try { localStorage.setItem(MAX_QUALITY_KEY, maxQuality) } catch {} }, [maxQuality])
  useEffect(() => { try { localStorage.setItem('freestream.customUserAgent', customUserAgent) } catch {} }, [customUserAgent])

  return {
    autoSkip, setAutoSkip, hideDead, setHideDead, hideBad, setHideBad,
    maxQuality, setMaxQuality, filterExpr, setFilterExpr,
    customUserAgent, setCustomUserAgent,
  }
}
