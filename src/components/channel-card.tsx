'use client'

import { Tv, Heart, Clock, Play, ZapOff } from 'lucide-react'
import type { Channel } from '@/lib/m3u-parser'
import { flagForCountry } from '@/lib/countries'
import { cn } from '@/lib/utils'

type ChannelCardProps = {
  channel: Channel
  active?: boolean
  fav?: boolean
  dead?: boolean
  recent?: boolean
  onSelect: () => void
  onToggleFav?: () => void
}

export function ChannelCard({ channel, active, fav, dead, recent, onSelect, onToggleFav }: ChannelCardProps) {
  const flag = channel.countryCode ? flagForCountry(channel.countryCode) : undefined
  return (
    <div
      className={cn(
        'card-hover group relative rounded-2xl overflow-hidden cursor-pointer',
        active ? 'ring-2 ring-primary shadow-lg shadow-primary/20' : 'bg-white/[0.04] hover:bg-white/[0.07]',
      )}
      onClick={onSelect}
    >
      {/* Logo area */}
      <div className="aspect-[4/3] flex items-center justify-center p-4 relative overflow-hidden">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.displayName}
            className="w-full h-full object-contain transition-transform group-hover:scale-105"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Tv className="w-10 h-10 text-white/20" />
          </div>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-center pb-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* LIVE badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600/90 backdrop-blur">
          <span className="w-1.5 h-1.5 rounded-full bg-white live-pulse" />
          <span className="text-[9px] font-bold text-white tracking-wide">LIVE</span>
        </div>

        {/* Quality badge */}
        {channel.quality && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] font-bold text-white/90 uppercase">
            {channel.quality}
          </div>
        )}

        {/* Dead overlay */}
        {dead && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <ZapOff className="w-6 h-6 text-red-500" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 pt-2">
        <div className="flex items-center gap-1.5 mb-1">
          {flag && <span className="text-xs shrink-0">{flag}</span>}
          <p className={cn(
            'text-sm font-semibold truncate',
            active ? 'text-primary' : 'text-white group-hover:text-white',
            dead && 'line-through opacity-50',
          )}>
            {channel.displayName}
          </p>
          {fav && <Heart className="w-3 h-3 text-primary fill-current shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5">
          {channel.isVod && <span className="text-[9px] font-bold px-1 py-0 rounded bg-blue-500/20 text-blue-400">VOD</span>}
          {recent && !fav && <Clock className="w-3 h-3 text-primary/50 shrink-0" />}
          <span className="text-xs text-white/40 truncate">{channel.group}</span>
        </div>
      </div>

      {/* Fav button */}
      {onToggleFav && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav() }}
          className={cn(
            'absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-opacity',
            fav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            fav ? 'bg-primary/20' : 'bg-black/50 hover:bg-black/70',
          )}
        >
          <Heart className={cn('w-3.5 h-3.5', fav ? 'text-primary fill-current' : 'text-white/70')} />
        </button>
      )}
    </div>
  )
}
