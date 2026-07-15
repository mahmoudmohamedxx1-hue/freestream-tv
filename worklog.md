---
Task ID: 1-9 (parent session)
Agent: main (super-z)
Task: Add Xtream Codes support, iptvnator/kptv-proxy/tuliprox features, Twitch/YouTube embeds, auto-updated playlists

Work Log:
- Explored existing project state: playlists.ts (36 providers, 102 filtered-v2 files), page.tsx (1400 lines), m3u-parser.ts, EPG API, video-player.tsx
- Researched 9 GitHub repos via subagent (iptvnator, kptv-proxy, tuliprox, twitch_to_m3u, skiesmate/m3u-merged, ireentv, abusaeeidx/T-Sports, abusaeeidx/CricHd, sm-monirulislam/SM-Live-TV)
- Confirmed: skiesmate/combined.m3u is BROKEN (contains HTML); skiesmate/sources.txt lists 4 working alex8875/m3u playlists (jcinema, jstar, jtv, z5)
- Confirmed: twitch_to_m3u requires a server — replaced with official Twitch iframe embed (no server needed)
- Added Xtream Codes client lib (src/lib/xtream.ts) — 10 XC actions, M3U/XMLTV getters
- Added Xtream Codes server proxy (src/app/api/xtream/route.ts) — POST body fetches arbitrary XC URLs server-side to bypass CORS/mixed-content
- Added tuliprox-style boolean/regex filter DSL (src/lib/filter-dsl.ts) — supports `Name ~ "regex" AND NOT Group ~ "regex"`, recursive descent parser
- Added Twitch/YouTube embed player (src/components/embed-player.tsx) — handles twitch:, twitch-vod:, twitch-clip:, youtube:, youtube-live: URL schemes via official iframe embeds
- Updated playlists.ts: added 3 new providers (Auto-Updated, Xtream Codes, Twitch & YouTube) covering 18 new playlist items (CricHD, T-Sports, SM-Live-TV, IreenTv Toffee/Tapmad/SonyLIV, JioCinema/JioStar/JioTV/Zee5, 8 popular Twitch channels, 8 popular YouTube live channels)
- Updated playlist API (src/app/api/playlist/route.ts): added `?refresh=1` cache-bust + special handling for embed URLs (returns synthetic multi-channel playlist from category's playlists array)
- Updated page.tsx:
  • Added 3-tab Admin panel (Custom Channels / Xtream Codes / Twitch & YouTube)
  • Xtream login UI: server + username + password, validates via player_api.php, saves to localStorage, "Open XC channels" button switches to XC provider and loads M3U via /get.php
  • Twitch/YouTube quick-add forms with prefixed URLs (twitch:, youtube:, youtube-live:)
  • Tuliprox-style filter DSL input in Settings with 8 quick presets (News, Sports, Movies, HD only, Not 4K, No XXX, Arabic, Clear)
  • Refresh button in header (cache-busts current playlist, also auto-applies to auto-updated + embed providers)
  • EPG "Now Playing" panel below player showing current program title, progress bar, time range, description (fetched from /api/epg?channel=<tvg-id>)
  • Player area now routes between VideoPlayer (HLS) and EmbedPlayer (iframe) based on URL scheme
  • EMBED badge shown for Twitch/YouTube channels
- Build verified: npx next build ✓ — all routes registered (/api/xtream included)

Stage Summary:
- 4 new files created: src/lib/xtream.ts, src/lib/filter-dsl.ts, src/app/api/xtream/route.ts, src/components/embed-player.tsx
- 3 files updated: src/lib/playlists.ts (3 new providers), src/app/api/playlist/route.ts (refresh + embed handling), src/app/page.tsx (3-tab admin, filter DSL, EPG panel, embed routing, refresh button)
- All 5 requested GitHub repos integrated: iptvnator (UX inspiration: admin tabbed UI, EPG now-playing, custom M3U), kptv-proxy (Xtream Codes client + EPG via xmltv.php), tuliprox (boolean/regex filter DSL), twitch_to_m3u (replaced with native iframe embed), skiesmate/m3u-merged sources + IreenTv + abusaeeidx T-Sports/CricHD + SM-Live-TV all added as auto-updating providers
- Xtream Codes works against any XC server or self-hosted kptv-proxy instance
- Auto-updating playlists: GitHub raw URLs are inherently live; Refresh button bypasses 10-min cache for manual refresh on any provider
- Build passes cleanly; no new TypeScript errors in any modified file
