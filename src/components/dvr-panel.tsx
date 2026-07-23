'use client'

import { useState, useEffect } from 'react'
import { X, Circle, Trash2, Download, Play, Clock } from 'lucide-react'
import type { Channel } from '@/lib/m3u-parser'

type Recording = {
  id: string
  name: string
  channel: string
  startedAt: number
  endedAt?: number
  duration: number
  status: 'recording' | 'completed' | 'error'
  size?: number
  error?: string
}

type DVRPanelProps = {
  currentChannel: Channel | null
  onClose: () => void
  onPlayRecording?: (rec: Recording) => void
}

export function DVRPanel({ currentChannel, onClose, onPlayRecording }: DVRPanelProps) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(3600) // default 1 hour

  const fetchRecordings = async () => {
    try {
      const res = await fetch('/api/dvr?list=1')
      const data = await res.json()
      setRecordings(data.recordings || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchRecordings() }, [])

  const startRecording = async () => {
    if (!currentChannel) return
    setRecording(true)
    try {
      await fetch('/api/dvr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentChannel.url,
          name: currentChannel.displayName,
          channel: currentChannel.group || '',
          duration,
        }),
      })
      await fetchRecordings()
    } catch (e) {
      alert('Failed to start recording')
    } finally {
      setRecording(false)
    }
  }

  const deleteRecording = async (id: string) => {
    if (!confirm('Delete this recording?')) return
    await fetch(`/api/dvr?id=${id}`, { method: 'DELETE' })
    fetchRecordings()
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
  }

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card rounded-xl border border-border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Circle className="w-4 h-4 text-red-500" />
            DVR Recordings ({recordings.length})
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current channel recording */}
        {currentChannel && !isEmbedUrl(currentChannel.url) && (
          <div className="p-4 border-b border-border bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-2">Record current channel:</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium flex-1 truncate">{currentChannel.displayName}</span>
              <select
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value))}
                className="bg-secondary text-xs rounded px-2 py-1"
              >
                <option value={1800}>30 min</option>
                <option value={3600}>1 hour</option>
                <option value={7200}>2 hours</option>
                <option value={14400}>4 hours</option>
                <option value={28800}>8 hours</option>
              </select>
              <button
                onClick={startRecording}
                disabled={recording}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
              >
                <Circle className="w-3 h-3 fill-current" />
                {recording ? 'Starting…' : 'Record'}
              </button>
            </div>
          </div>
        )}

        {/* Recordings list */}
        <div className="flex-1 overflow-y-auto thin-scroll p-2">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : recordings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No recordings yet. Click "Record" to capture the current channel.
            </div>
          ) : (
            <div className="space-y-1">
              {recordings.map(rec => (
                <div key={rec.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/60 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{rec.name}</p>
                      {rec.status === 'recording' && (
                        <span className="flex items-center gap-1 text-[10px] text-red-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> REC
                        </span>
                      )}
                      {rec.status === 'completed' && (
                        <span className="text-[10px] text-green-500">✓</span>
                      )}
                      {rec.status === 'error' && (
                        <span className="text-[10px] text-destructive">✗ {rec.error}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(rec.startedAt)} · {formatDuration(rec.duration)} · {formatSize(rec.size)}
                    </p>
                  </div>
                  {rec.status === 'completed' && (
                    <>
                      <button
                        onClick={() => onPlayRecording?.(rec)}
                        className="p-1.5 rounded hover:bg-primary/20 text-primary"
                        title="Play"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <a
                        href={`/api/dvr?id=${rec.id}&download=1`}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => deleteRecording(rec.id)}
                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function isEmbedUrl(url: string): boolean {
  return /^(twitch:|twitch-vod:|twitch-clip:|youtube:|youtube-live:)/i.test(url)
}
