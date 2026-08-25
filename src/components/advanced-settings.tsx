'use client'

import { useState, useEffect } from 'react'
import {
  Activity, Volume2, Keyboard, Palette, Download, Upload,
  Hash, Users, Languages, Calendar, Sun, Moon, Monitor,
  ListCollection, Shield, RefreshCw,
} from 'lucide-react'
import {
  useAudioEnhancer, useHotkeys, useThemeCustomizer,
  useChannelNumbers, useWatchParty, useTranslationOverlay,
  useDVRQuality, useUpcomingEvents, useThemeMode,
  exportAllSettings, importAllSettings,
} from '@/hooks/use-advanced-features'

type AdvancedSettingsProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  onClose: () => void
}

export function AdvancedSettingsPanel({ videoRef, onClose }: AdvancedSettingsProps) {
  const [section, setSection] = useState<'audio' | 'hotkeys' | 'theme' | 'data' | 'channels' | 'social' | 'translate' | 'dvr' | 'calendar' | 'appearance'>('appearance')

  const audio = useAudioEnhancer(videoRef)
  const hotkeys = useHotkeys()
  const theme = useThemeCustomizer()
  const channelNumbers = useChannelNumbers()
  const watchParty = useWatchParty()
  const translation = useTranslationOverlay()
  const dvrQuality = useDVRQuality()
  const events = useUpcomingEvents()
  const themeMode = useThemeMode()

  const sections = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard },
    { id: 'channels', label: 'Channel Numbers', icon: Hash },
    { id: 'social', label: 'Watch Party', icon: Users },
    { id: 'translate', label: 'Translation', icon: Languages },
    { id: 'dvr', label: 'DVR Quality', icon: Activity },
    { id: 'calendar', label: 'Events', icon: Calendar },
    { id: 'data', label: 'Backup/Restore', icon: Download },
  ] as const

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] bg-elevated rounded-2xl border border-white/5 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="text-sm font-bold">Advanced Settings</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 shrink-0 border-r border-white/5 p-2 overflow-y-auto thin-scroll">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${section === s.id ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto thin-scroll space-y-3">
            {/* Appearance */}
            {section === 'appearance' && (
              <>
                <div>
                  <label className="text-xs font-medium mb-2 block">Theme Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([['dark', Moon], ['light', Sun], ['auto', Monitor]] as const).map(([mode, Icon]) => (
                      <button key={mode} onClick={() => themeMode.setMode(mode)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition ${themeMode.mode === mode ? 'bg-primary text-white' : 'bg-white/5 hover:bg-white/10'}`}>
                        <Icon className="w-4 h-4" />
                        <span className="text-xs capitalize">{mode}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-2 block">Accent Color</label>
                  <div className="flex gap-2">
                    {['#E50914', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'].map(c => (
                      <button key={c} onClick={() => theme.update({ accentColor: c })}
                        className={`w-8 h-8 rounded-full transition ${theme.accentColor === c ? 'ring-2 ring-white ring-offset-2' : ''}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-2 block">Card Density</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['compact', 'comfortable', 'spacious'] as const).map(d => (
                      <button key={d} onClick={() => theme.update({ cardDensity: d })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium ${theme.cardDensity === d ? 'bg-primary text-white' : 'bg-white/5'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Audio */}
            {section === 'audio' && (
              <>
                {!audio.enabled ? (
                  <button onClick={audio.init} className="w-full p-3 rounded-xl bg-primary text-white text-sm font-medium">
                    Enable Audio Enhancer
                  </button>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Volume Boost: {audio.gain.toFixed(1)}x</label>
                      <input type="range" min="0.5" max="3" step="0.1" value={audio.gain} onChange={e => audio.setGain(parseFloat(e.target.value))} className="w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Bass: {audio.bass > 0 ? `+${audio.bass}` : audio.bass} dB</label>
                      <input type="range" min="-12" max="12" step="1" value={audio.bass} onChange={e => audio.setBass(parseInt(e.target.value))} className="w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Treble: {audio.treble > 0 ? `+${audio.treble}` : audio.treble} dB</label>
                      <input type="range" min="-12" max="12" step="1" value={audio.treble} onChange={e => audio.setTreble(parseInt(e.target.value))} className="w-full" />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Hotkeys */}
            {section === 'hotkeys' && (
              <div className="space-y-2">
                {Object.entries(hotkeys.hotkeys).map(([action, key]) => (
                  <div key={action} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]">
                    <span className="text-xs font-medium capitalize">{action.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <kbd className="px-2 py-1 rounded bg-white/5 text-xs font-mono min-w-[40px] text-center">{key === ' ' ? 'Space' : key}</kbd>
                  </div>
                ))}
              </div>
            )}

            {/* Channel Numbers */}
            {section === 'channels' && (
              <div className="text-center py-4">
                <Hash className="w-10 h-10 mx-auto mb-3 text-white/20" />
                <p className="text-sm font-medium">Channel Number Assignment</p>
                <p className="text-xs text-muted-foreground mt-1">Assign custom numbers to channels. Type the number in the player to jump.</p>
                <p className="text-xs text-muted-foreground mt-2">{Object.keys(channelNumbers.numbers).length} channels assigned</p>
              </div>
            )}

            {/* Watch Party */}
            {section === 'social' && (
              <div className="text-center py-4">
                <Users className="w-10 h-10 mx-auto mb-3 text-white/20" />
                <p className="text-sm font-medium">Watch Party</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Watch together with friends in sync</p>
                {!watchParty.active ? (
                  <button onClick={() => watchParty.createParty()} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium">
                    Create Party
                  </button>
                ) : (
                  <div>
                    <p className="text-xs">Party ID: <span className="font-mono font-bold text-primary">{watchParty.partyId}</span></p>
                    <p className="text-xs text-muted-foreground mt-1">{watchParty.participants} participant(s)</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{watchParty.getPartyLink()}</p>
                    <button onClick={watchParty.leaveParty} className="mt-2 px-4 py-2 rounded-xl bg-destructive/20 text-destructive text-xs font-medium">Leave Party</button>
                  </div>
                )}
              </div>
            )}

            {/* Translation */}
            {section === 'translate' && (
              <div>
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03]">
                  <span className="text-sm font-medium">Enable Translation Overlay</span>
                  <input type="checkbox" checked={translation.enabled} onChange={e => translation.setEnabled(e.target.checked)} className="w-5 h-5" />
                </label>
                {translation.enabled && (
                  <div className="mt-2">
                    <label className="text-xs font-medium mb-1 block">Target Language</label>
                    <select value={translation.targetLang} onChange={e => translation.setTargetLang(e.target.value)} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm">
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="ar">Arabic</option>
                      <option value="hi">Hindi</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                      <option value="pt">Portuguese</option>
                      <option value="ru">Russian</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* DVR Quality */}
            {section === 'dvr' && (
              <div>
                <label className="text-xs font-medium mb-2 block">Recording Quality</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['480p', '720p', '1080p', 'source'] as const).map(q => (
                    <button key={q} onClick={() => dvrQuality.setQuality(q)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${dvrQuality.quality === q ? 'bg-primary text-white' : 'bg-white/5'}`}>
                      {q === 'source' ? 'Source (Best)' : q.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar */}
            {section === 'calendar' && (
              <div>
                <button onClick={events.generateEvents} className="mb-3 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium">
                  Load Upcoming Events
                </button>
                <div className="space-y-2">
                  {events.events.slice(0, 10).map(evt => (
                    <div key={evt.id} className="p-2 rounded-lg bg-white/[0.03] flex items-center gap-3">
                      <div className="w-12 text-center">
                        <p className="text-[10px] text-muted-foreground">{new Date(evt.date).toLocaleDateString('en', { month: 'short' })}</p>
                        <p className="text-lg font-bold">{new Date(evt.date).getDate()}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{evt.title}</p>
                        <p className="text-xs text-muted-foreground">{evt.league} · {evt.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Backup/Restore */}
            {section === 'data' && (
              <div className="space-y-3">
                <div>
                  <button onClick={() => {
                    const data = exportAllSettings()
                    const blob = new Blob([data], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `freestream-backup-${Date.now()}.json`; a.click()
                    URL.revokeObjectURL(url)
                  }} className="w-full flex items-center gap-2 p-3 rounded-xl bg-primary text-white text-sm font-medium">
                    <Download className="w-4 h-4" /> Export All Settings
                  </button>
                </div>
                <div>
                  <label className="block">
                    <input type="file" accept=".json" className="hidden" onChange={e => {
                      const file = e.target.files?.[0]; if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => {
                        const success = importAllSettings(ev.target?.result as string)
                        alert(success ? 'Settings imported! Reload to apply.' : 'Import failed.')
                      }
                      reader.readAsText(file)
                    }} />
                    <span className="w-full flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium cursor-pointer">
                      <Upload className="w-4 h-4" /> Import Settings
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
