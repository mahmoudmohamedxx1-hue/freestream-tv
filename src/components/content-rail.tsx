'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ChannelCard } from './channel-card'
import type { Channel } from '@/lib/m3u-parser'
import { cn } from '@/lib/utils'

type ContentRailProps = {
  title: string
  channels: Channel[]
  currentChannel?: Channel | null
  favorites: Set<string>
  deadChannels: Set<string>
  recentSet: Set<string>
  onSelectChannel: (ch: Channel) => void
  onToggleFav: (ch: Channel) => void
  className?: string
}

export function ContentRail({
  title, channels, currentChannel, favorites, deadChannels, recentSet,
  onSelectChannel, onToggleFav, className,
}: ContentRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 400
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  if (channels.length === 0) return null

  return (
    <section className={cn('group/rail', className)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <div className="flex items-center gap-1 opacity-0 group-hover/rail:opacity-100 transition-opacity">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1"
      >
        {channels.map((ch, i) => (
          <div key={ch.id + ch.url} className="w-44 shrink-0 fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
            <ChannelCard
              channel={ch}
              active={currentChannel?.url === ch.url}
              fav={favorites.has(ch.url)}
              dead={deadChannels.has(ch.url)}
              recent={recentSet.has(ch.url)}
              onSelect={() => onSelectChannel(ch)}
              onToggleFav={() => onToggleFav(ch)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
