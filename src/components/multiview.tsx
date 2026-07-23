'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Volume2, VolumeX, Maximize2 } from 'lucide-react'
import { VideoPlayer } from './video-player'
import { EmbedPlayer, isEmbedUrl } from './embed-player'
import type { Channel } from '@/lib/m3u-parser'

type MultiViewProps = {
  channels: Channel[]
  onClose: () => void
  onSelectChannel?: (ch: Channel) => void
}

type Cell = {
  channel: Channel | null
  muted: boolean
}

export function MultiView({ channels, onClose, onSelectChannel }: MultiViewProps) {
  const [cells, setCells] = useState<Cell[]>([
    { channel: channels[0] || null, muted: false },
    { channel: channels[1] || null, muted: true },
    { channel: channels[2] || null, muted: true },
    { channel: channels[3] || null, muted: true },
  ])
  const [layout, setLayout] = useState<'2x1' | '2x2' | '3x1'>('2x2')
  const [activeCell, setActiveCell] = useState(0)

  const gridClass = layout === '2x1' ? 'grid-cols-1 grid-rows-2'
    : layout === '2x2' ? 'grid-cols-2 grid-rows-2'
    : 'grid-cols-3 grid-rows-1'

  const setCellChannel = (i: number, ch: Channel | null) => {
    setCells(prev => prev.map((c, idx) => idx === i ? { ...c, channel: ch } : c))
  }

  const toggleMute = (i: number) => {
    setCells(prev => prev.map((c, idx) => idx === i ? { ...c, muted: !c.muted } : c))
  }

  // Only one cell can be unmuted at a time (audio)
  const unmuteCell = (i: number) => {
    setCells(prev => prev.map((c, idx) => ({ ...c, muted: idx !== i })))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Maximize2 className="w-4 h-4" />
          Multi-View ({cells.filter(c => c.channel).length}/{cells.length} active)
        </h2>
        <div className="flex gap-1">
          {(['2x1', '2x2', '3x1'] as const).map(l => (
            <button
              key={l}
              onClick={() => {
                setLayout(l)
                const count = l === '2x1' ? 2 : l === '2x2' ? 4 : 3
                setCells(prev => {
                  const next = [...prev]
                  while (next.length < count) next.push({ channel: null, muted: true })
                  while (next.length > count) next.pop()
                  return next
                })
              }}
              className={`px-2 py-1 rounded text-xs font-mono transition ${
                layout === l ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Grid */}
      <div className={`flex-1 grid ${gridClass} gap-1 p-1`}>
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`relative bg-black rounded overflow-hidden border-2 transition ${
              activeCell === i ? 'border-primary' : 'border-transparent'
            }`}
            onClick={() => { setActiveCell(i); if (!cell.muted) unmuteCell(i) }}
          >
            {cell.channel ? (
              <>
                {/* Player */}
                <div className="absolute inset-0">
                  {isEmbedUrl(cell.channel.url) ? (
                    <div className="w-full h-full pointer-events-none opacity-90">
                      <div className="w-full h-full scale-90">
                        <EmbedPlayer url={cell.channel.url} channelName={cell.channel.displayName} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full pointer-events-none">
                      <VideoPlayer src={cell.channel.url} channelName={cell.channel.displayName} />
                    </div>
                  )}
                </div>

                {/* Overlay info */}
                <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate flex-1">{cell.channel.displayName}</span>
                    <span className="text-[10px] text-white/60">#{i + 1}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent z-10 flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMute(i) }}
                    className="p-1.5 rounded hover:bg-white/20 text-white"
                    title={cell.muted ? 'Unmute' : 'Mute'}
                  >
                    {cell.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onSelectChannel) onSelectChannel(cell.channel!)
                      onClose()
                    }}
                    className="p-1.5 rounded hover:bg-white/20 text-white text-xs"
                    title="Open in main player"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCellChannel(i, null) }}
                    className="p-1.5 rounded hover:bg-red-500/50 text-white"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              /* Empty cell — show channel picker */
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
                <Plus className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-500 mb-2">Slot {i + 1} — Click a channel below</p>
                <select
                  className="bg-zinc-800 text-white text-xs rounded px-2 py-1 max-w-[200px]"
                  value=""
                  onChange={(e) => {
                    const ch = channels.find(c => c.url === e.target.value)
                    if (ch) { setCellChannel(i, ch); unmuteCell(i) }
                  }}
                >
                  <option value="">Select channel…</option>
                  {channels.slice(0, 100).map(ch => (
                    <option key={ch.id} value={ch.url}>{ch.displayName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
