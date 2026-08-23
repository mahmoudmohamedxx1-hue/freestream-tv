# 📺 FreeStream TV

> Free live TV streaming platform — 36,000+ channels from 25+ providers. No signup, no subscription, no ads.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## ✨ Features

### Streaming
- **36,000+ channels** from 25+ providers (IPTV-org, Pluto TV, Samsung TV Plus, LG Channels, Tubi, Roku, Xumo, and more)
- **Native HLS playback** via HLS.js with quality selector, subtitles, and Picture-in-Picture
- **Twitch live streams** — server-side HLS proxy bypasses iframe parent restrictions
- **YouTube live embeds** — 24/7 news, music, and entertainment channels
- **Xtream Codes support** — login to any XC provider with a built-in mock demo server
- **Stalker Portal support** — MAC-based authentication for Ministra/Stalker portals
- **Auto-updating playlists** — GitHub Actions-backed sources that refresh every 15min–6h
- **Football Live** — Premier League, La Liga, and auto-updating football M3U sources

### Player Features
- **DVR/Recording** — server-side HLS recording with download and playback
- **Multi-View** — watch 2–4 channels simultaneously in a grid layout
- **Catchup/Timeshift** — 10-minute back-buffer for seeking backward in live streams
- **PiP** — native browser Picture-in-Picture
- **Quality selector** — auto/4K/1080p/720p/480p
- **Subtitle support** — CC track selection
- **Keyboard shortcuts** — ↑↓ (prev/next), Space (play/pause), F (fullscreen), P (PiP), 1-9 (jump), Ctrl+K (search), ? (help)

### Content Management
- **Custom M3U import** — paste URL or drag-and-drop .m3u file
- **Custom channel add** — add individual streams (HLS, Twitch, YouTube)
- **Filter DSL** — tuliprox-style boolean + regex filtering (`Name ~ ".*NBA.*" AND NOT Group ~ ".*XXX.*"`)
- **Global search** — searches iptv-org's 8,000+ channel index (Ctrl+K)
- **Cloud sync** — sync favorites and history across devices with a sync key
- **EPG** — "Now Playing" panel with program guide (YanG-1989 XMLTV + synthesized fallback)
- **Custom User-Agent** — per-playlist UA for streams that require specific headers

### UI/UX
- **Dark streaming theme** — Netflix-inspired deep black + red accent (#E50914)
- **Glassmorphism header** — organized icon groups with dividers
- **Channel cards** — logos, quality badges, VOD indicators, hover effects
- **Favorites & Recently Watched** — grid modals with thumbnail view
- **Arabic/English** — RTL support with language toggle
- **Responsive** — works on mobile, tablet, and desktop

### Android App
- **Native APK** — ExoPlayer (Media3) for hardware-accelerated HLS playback
- **36,000+ bundled channels** — works offline for browsing
- **Material Design** — dark theme matching the website
- **Search, categories, favorites** — all native Android UI
- **Download** from the website header

## 🏗️ Architecture

```
freestream-tv/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main UI (3,000+ lines)
│   │   ├── globals.css           # Dark theme + animations
│   │   └── api/
│   │       ├── playlist/         # M3U parser + cache
│   │       ├── twitch/           # Twitch HLS proxy (GQL + usher API)
│   │       ├── xtream/           # Xtream Codes CORS proxy
│   │       ├── xtream-mock/      # Mock XC server with real streams
│   │       ├── stalker/          # Stalker Portal proxy
│   │       ├── dvr/              # Server-side HLS recording
│   │       ├── sync/             # Cloud sync (favorites/history)
│   │       ├── epg/              # EPG (XMLTV + synthesized)
│   │       ├── tv-guide/         # TV guide with genres
│   │       └── trending/         # Live sports trending
│   ├── components/
│   │   ├── video-player.tsx      # HLS.js player with quality/PiP/subtitles
│   │   ├── embed-player.tsx      # Twitch/YouTube embed + HLS resolver
│   │   ├── multiview.tsx         # Multi-channel grid player
│   │   └── dvr-panel.tsx         # Recording management
│   └── lib/
│       ├── playlists.ts          # 25+ providers, 100+ playlists
│       ├── m3u-parser.ts         # M3U/M3U8 parser
│       ├── xtream.ts             # Xtream Codes client
│       ├── stalker.ts            # Stalker Portal client
│       ├── filter-dsl.ts         # Boolean/regex filter compiler
│       └── countries.ts          # ISO country → flag mapping
├── android-app/                  # Native Android app (ExoPlayer)
├── public/                       # 358 M3U playlists + logos
└── scripts/                      # Analysis + curation scripts
```

## 🚀 Quick Start

```bash
# Install
npm install

# Development
npm run dev

# Production build
npm run build && npm start
```

## 📱 Android App

Download the APK from the website header or build from source:

```bash
cd android-app
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

## 📊 Provider Catalog

| Provider | Channels | Type |
|----------|----------|------|
| Best of FreeStream | 783 | Curated (verified) |
| IPTV-org | 8,000+ | Public directory |
| Pluto TV | 410+ | FAST |
| Samsung TV Plus | 252+ | FAST |
| LG Channels | 445+ | FAST |
| Tubi TV | 277+ | FAST |
| Roku Channel | 353+ | FAST |
| China & Asia (imDazui) | 2,142+ | Regional |
| Auto-Updated (GitHub Actions) | 500+ | Auto-refresh |
| Football Live | 333+ | Premier League + La Liga |
| Twitch & YouTube | 80+ | Embeds |
| Xtream Codes | Any | User's XC server |
| Stalker Portal | Any | User's portal |
| Countries | 781 | 48 countries |
| Leagues | 170 | 13 leagues |
| World Regions | 767 | 8 regions |

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+K` | Global search |
| `↑` / `↓` | Previous / next channel |
| `1-9, 0` | Jump to channel #1-10 |
| `Space` | Play / pause |
| `F` | Fullscreen |
| `P` | Picture-in-Picture |
| `?` | Toggle help |
| `Esc` | Close overlay |

## 🛡️ Legal Disclaimer

FreeStream TV aggregates publicly available IPTV streams from open-source projects (iptv-org, imDazui, YanG-1989, etc.). We do not host, stream, or distribute any content. All streams are sourced from third-party providers and may be subject to copyright laws in your jurisdiction. Use at your own discretion.

## 📄 License

MIT
