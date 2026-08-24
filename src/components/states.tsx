'use client'

import { Tv, Heart, Clock, Search, AlertCircle, Radio } from 'lucide-react'

type EmptyStateProps = {
  type: 'favorites' | 'recent' | 'search' | 'channels' | 'source' | 'stream' | 'network'
  title?: string
  message?: string
  action?: { label: string; onClick: () => void }
}

const defaults = {
  favorites: { icon: Heart, title: 'No favorites yet', message: 'Tap the heart on any channel to save it here for quick access.' },
  recent: { icon: Clock, title: 'Nothing watched yet', message: 'Your recently watched channels will appear here.' },
  search: { icon: Search, title: 'No results found', message: 'Try a different channel name, category, or country.' },
  channels: { icon: Tv, title: 'No channels available', message: 'Try selecting a different source or category.' },
  source: { icon: Radio, title: 'No source selected', message: 'Choose a provider from the home page to start watching.' },
  stream: { icon: AlertCircle, title: 'Stream unavailable', message: 'This stream may be offline or geo-restricted. Try another channel.' },
  network: { icon: AlertCircle, title: 'Connection error', message: 'Check your internet connection and try again.' },
}

export function EmptyState({ type, title, message, action }: EmptyStateProps) {
  const d = defaults[type]
  const Icon = d.icon
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-white/30" />
      </div>
      <h3 className="text-lg font-bold mb-1">{title || d.title}</h3>
      <p className="text-sm text-white/50 max-w-sm">{message || d.message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function LoadingState({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden">
          <div className="aspect-[4/3] shimmer rounded-2xl" />
          <div className="pt-2 space-y-2">
            <div className="h-4 w-3/4 rounded shimmer" />
            <div className="h-3 w-1/2 rounded shimmer" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonRail({ title }: { title: string }) {
  return (
    <section>
      <div className="h-6 w-40 rounded shimmer mb-3" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-44 shrink-0">
            <div className="aspect-[4/3] shimmer rounded-2xl" />
            <div className="pt-2 space-y-2">
              <div className="h-4 w-3/4 rounded shimmer" />
              <div className="h-3 w-1/2 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
