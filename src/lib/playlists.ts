// Pre-loaded M3U playlist sources
// Sources: iptv-org project, Free-TV project — all public, free, legal playlists

export type PlaylistSource = {
  id: string
  name: string
  description: string
  url: string
  category: 'arabic' | 'global' | 'sports' | 'news' | 'movies' | 'music' | 'kids' | 'entertainment' | 'free-tv'
  flag?: string
}

export const PLAYLIST_SOURCES: PlaylistSource[] = [
  {
    id: 'arabic',
    name: 'Arabic Channels',
    description: 'All Arabic-language channels from IPTV-org',
    url: 'https://iptv-org.github.io/iptv/languages/ara.m3u',
    category: 'arabic',
    flag: '🇸🇦',
  },
  {
    id: 'global',
    name: 'Global (8000+)',
    description: 'Complete worldwide index — all countries',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    category: 'global',
    flag: '🌍',
  },
  {
    id: 'free-tv',
    name: 'Free-TV (Pluto/Plex/Samsung)',
    description: 'Official free channels from Pluto TV, Plex TV, Samsung TV Plus',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    category: 'free-tv',
    flag: '📺',
  },
  {
    id: 'sports',
    name: 'Sports',
    description: 'Sports channels worldwide',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    category: 'sports',
    flag: '⚽',
  },
  {
    id: 'news',
    name: 'News',
    description: 'News channels worldwide',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    category: 'news',
    flag: '📰',
  },
  {
    id: 'movies',
    name: 'Movies',
    description: 'Movie channels worldwide',
    url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    category: 'movies',
    flag: '🎬',
  },
  {
    id: 'music',
    name: 'Music',
    description: 'Music channels worldwide',
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    category: 'music',
    flag: '🎵',
  },
  {
    id: 'kids',
    name: 'Kids',
    description: 'Kids channels worldwide',
    url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',
    category: 'kids',
    flag: '👶',
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    description: 'Entertainment channels worldwide',
    url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u',
    category: 'entertainment',
    flag: '🎪',
  },
]

export function getPlaylistById(id: string): PlaylistSource | undefined {
  return PLAYLIST_SOURCES.find((p) => p.id === id)
}
