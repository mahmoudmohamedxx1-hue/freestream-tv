// Playlist provider catalog
// Organized by PROVIDER (IPTV-org, Free-TV, Ustream, Arab-IPTV), each with its own
// internal categories. This replaces the old flat 10-category structure.

export type PlaylistItem = {
  id: string
  name: string
  flag?: string
  url: string
}

export type ProviderCategory = {
  id: string
  name: string
  flag?: string
  /** If set, clicking this category loads this URL directly (no playlist picker) */
  directUrl?: string
  /** If set, this category contains multiple sub-playlists to pick from */
  playlists?: PlaylistItem[]
}

export type Provider = {
  id: string
  name: string
  description: string
  flag: string
  categories: ProviderCategory[]
}

export const PROVIDERS: Provider[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // IPTV-org — the main public IPTV directory
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'iptv-org',
    name: 'IPTV-org',
    description: 'Public IPTV directory — 8000+ channels',
    flag: '🌍',
    categories: [
      {
        id: 'languages',
        name: 'By Language',
        flag: '🗣️',
        playlists: [
          { id: 'ara', name: 'Arabic', flag: '🇸🇦', url: 'https://iptv-org.github.io/iptv/languages/ara.m3u' },
          { id: 'eng', name: 'English', flag: '🇬🇧', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u' },
          { id: 'fra', name: 'French', flag: '🇫🇷', url: 'https://iptv-org.github.io/iptv/languages/fra.m3u' },
          { id: 'deu', name: 'German', flag: '🇩🇪', url: 'https://iptv-org.github.io/iptv/languages/deu.m3u' },
          { id: 'rus', name: 'Russian', flag: '🇷🇺', url: 'https://iptv-org.github.io/iptv/languages/rus.m3u' },
          { id: 'tur', name: 'Turkish', flag: '🇹🇷', url: 'https://iptv-org.github.io/iptv/languages/tur.m3u' },
          { id: 'hin', name: 'Hindi', flag: '🇮🇳', url: 'https://iptv-org.github.io/iptv/languages/hin.m3u' },
          { id: 'urd', name: 'Urdu', flag: '🇵🇰', url: 'https://iptv-org.github.io/iptv/languages/urd.m3u' },
          { id: 'zho', name: 'Chinese', flag: '🇨🇳', url: 'https://iptv-org.github.io/iptv/languages/zho.m3u' },
          { id: 'fas', name: 'Persian', flag: '🇮🇷', url: 'https://iptv-org.github.io/iptv/languages/per.m3u' },
          { id: 'heb', name: 'Hebrew', flag: '🇮🇱', url: 'https://iptv-org.github.io/iptv/languages/heb.m3u' },
          { id: 'kur', name: 'Kurdish', flag: '☀️', url: 'https://iptv-org.github.io/iptv/languages/kur.m3u' },
          { id: 'spa', name: 'Spanish', flag: '🇪🇸', url: 'https://iptv-org.github.io/iptv/languages/spa.m3u' },
          { id: 'por', name: 'Portuguese', flag: '🇵🇹', url: 'https://iptv-org.github.io/iptv/languages/por.m3u' },
        ],
      },
      {
        id: 'countries-arabic',
        name: 'Arabic Countries',
        flag: '🇸🇦',
        playlists: [
          { id: 'eg', name: 'Egypt', flag: '🇪🇬', url: 'https://iptv-org.github.io/iptv/countries/eg.m3u' },
          { id: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', url: 'https://iptv-org.github.io/iptv/countries/sa.m3u' },
          { id: 'ae', name: 'UAE', flag: '🇦🇪', url: 'https://iptv-org.github.io/iptv/countries/ae.m3u' },
          { id: 'qa', name: 'Qatar', flag: '🇶🇦', url: 'https://iptv-org.github.io/iptv/countries/qa.m3u' },
          { id: 'kw', name: 'Kuwait', flag: '🇰🇼', url: 'https://iptv-org.github.io/iptv/countries/kw.m3u' },
          { id: 'bh', name: 'Bahrain', flag: '🇧🇭', url: 'https://iptv-org.github.io/iptv/countries/bh.m3u' },
          { id: 'om', name: 'Oman', flag: '🇴🇲', url: 'https://iptv-org.github.io/iptv/countries/om.m3u' },
          { id: 'ye', name: 'Yemen', flag: '🇾🇪', url: 'https://iptv-org.github.io/iptv/countries/ye.m3u' },
          { id: 'jo', name: 'Jordan', flag: '🇯🇴', url: 'https://iptv-org.github.io/iptv/countries/jo.m3u' },
          { id: 'lb', name: 'Lebanon', flag: '🇱🇧', url: 'https://iptv-org.github.io/iptv/countries/lb.m3u' },
          { id: 'sy', name: 'Syria', flag: '🇸🇾', url: 'https://iptv-org.github.io/iptv/countries/sy.m3u' },
          { id: 'iq', name: 'Iraq', flag: '🇮🇶', url: 'https://iptv-org.github.io/iptv/countries/iq.m3u' },
          { id: 'ps', name: 'Palestine', flag: '🇵🇸', url: 'https://iptv-org.github.io/iptv/countries/ps.m3u' },
          { id: 'sd', name: 'Sudan', flag: '🇸🇩', url: 'https://iptv-org.github.io/iptv/countries/sd.m3u' },
          { id: 'ly', name: 'Libya', flag: '🇱🇾', url: 'https://iptv-org.github.io/iptv/countries/ly.m3u' },
          { id: 'tn', name: 'Tunisia', flag: '🇹🇳', url: 'https://iptv-org.github.io/iptv/countries/tn.m3u' },
          { id: 'dz', name: 'Algeria', flag: '🇩🇿', url: 'https://iptv-org.github.io/iptv/countries/dz.m3u' },
          { id: 'ma', name: 'Morocco', flag: '🇲🇦', url: 'https://iptv-org.github.io/iptv/countries/ma.m3u' },
          { id: 'mr', name: 'Mauritania', flag: '🇲🇷', url: 'https://iptv-org.github.io/iptv/countries/mr.m3u' },
          { id: 'so', name: 'Somalia', flag: '🇸🇴', url: 'https://iptv-org.github.io/iptv/countries/so.m3u' },
        ],
      },
      {
        id: 'countries-world',
        name: 'World Countries',
        flag: '🗺️',
        playlists: [
          { id: 'us', name: 'USA', flag: '🇺🇸', url: 'https://iptv-org.github.io/iptv/countries/us.m3u' },
          { id: 'uk', name: 'UK', flag: '🇬🇧', url: 'https://iptv-org.github.io/iptv/countries/uk.m3u' },
          { id: 'ca', name: 'Canada', flag: '🇨🇦', url: 'https://iptv-org.github.io/iptv/countries/ca.m3u' },
          { id: 'fr', name: 'France', flag: '🇫🇷', url: 'https://iptv-org.github.io/iptv/countries/fr.m3u' },
          { id: 'de', name: 'Germany', flag: '🇩🇪', url: 'https://iptv-org.github.io/iptv/countries/de.m3u' },
          { id: 'tr', name: 'Turkey', flag: '🇹🇷', url: 'https://iptv-org.github.io/iptv/countries/tr.m3u' },
          { id: 'ir', name: 'Iran', flag: '🇮🇷', url: 'https://iptv-org.github.io/iptv/countries/ir.m3u' },
          { id: 'in', name: 'India', flag: '🇮🇳', url: 'https://iptv-org.github.io/iptv/countries/in.m3u' },
          { id: 'pk', name: 'Pakistan', flag: '🇵🇰', url: 'https://iptv-org.github.io/iptv/countries/pk.m3u' },
          { id: 'ru', name: 'Russia', flag: '🇷🇺', url: 'https://iptv-org.github.io/iptv/countries/ru.m3u' },
          { id: 'cn', name: 'China', flag: '🇨🇳', url: 'https://iptv-org.github.io/iptv/countries/cn.m3u' },
          { id: 'jp', name: 'Japan', flag: '🇯🇵', url: 'https://iptv-org.github.io/iptv/countries/jp.m3u' },
          { id: 'kr', name: 'Korea', flag: '🇰🇷', url: 'https://iptv-org.github.io/iptv/countries/kr.m3u' },
          { id: 'br', name: 'Brazil', flag: '🇧🇷', url: 'https://iptv-org.github.io/iptv/countries/br.m3u' },
          { id: 'mx', name: 'Mexico', flag: '🇲🇽', url: 'https://iptv-org.github.io/iptv/countries/mx.m3u' },
          { id: 'za', name: 'South Africa', flag: '🇿🇦', url: 'https://iptv-org.github.io/iptv/countries/za.m3u' },
          { id: 'ng', name: 'Nigeria', flag: '🇳🇬', url: 'https://iptv-org.github.io/iptv/countries/ng.m3u' },
        ],
      },
      {
        id: 'genres',
        name: 'By Genre',
        flag: '🎬',
        playlists: [
          { id: 'sports', name: 'Sports', flag: '⚽', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
          { id: 'news', name: 'News', flag: '📰', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
          { id: 'movies', name: 'Movies', flag: '🎬', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
          { id: 'music', name: 'Music', flag: '🎵', url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
          { id: 'kids', name: 'Kids', flag: '👶', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
          { id: 'entertainment', name: 'Entertainment', flag: '🎪', url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u' },
          { id: 'documentary', name: 'Documentary', flag: '🔬', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' },
          { id: 'religious', name: 'Religious', flag: '🕌', url: 'https://iptv-org.github.io/iptv/categories/religious.m3u' },
          { id: 'culture', name: 'Culture', flag: '🏛️', url: 'https://iptv-org.github.io/iptv/categories/culture.m3u' },
          { id: 'education', name: 'Education', flag: '🎓', url: 'https://iptv-org.github.io/iptv/categories/education.m3u' },
          { id: 'series', name: 'Series', flag: '📺', url: 'https://iptv-org.github.io/iptv/categories/series.m3u' },
          { id: 'business', name: 'Business', flag: '💼', url: 'https://iptv-org.github.io/iptv/categories/business.m3u' },
        ],
      },
      {
        id: 'indexes',
        name: 'Indexes',
        flag: '📚',
        playlists: [
          { id: 'global', name: 'Global (8000+)', flag: '🌍', url: 'https://iptv-org.github.io/iptv/index.m3u' },
          { id: 'index-category', name: 'Sorted by Category', flag: '🗂️', url: 'https://iptv-org.github.io/iptv/index.category.m3u' },
          { id: 'index-country', name: 'Sorted by Country', flag: '🗺️', url: 'https://iptv-org.github.io/iptv/index.country.m3u' },
          { id: 'index-language', name: 'Sorted by Language', flag: '🗣️', url: 'https://iptv-org.github.io/iptv/index.language.m3u' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Free-TV — Pluto TV, Plex TV, Samsung TV Plus (official free channels)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'free-tv',
    name: 'Free-TV',
    description: 'Pluto TV, Plex TV, Samsung TV Plus — official free channels',
    flag: '📺',
    categories: [
      {
        id: 'all',
        name: 'All Free-TV',
        flag: '📺',
        directUrl: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Arab IPTV (yazki87) — filtered Arabic list
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'arab-iptv',
    name: 'Arab IPTV',
    description: 'Filtered Arabic channels by yazki87',
    flag: '🇦🇪',
    categories: [
      {
        id: 'filtered',
        name: 'Filtered List',
        flag: '✨',
        directUrl: 'https://raw.githubusercontent.com/yazki87/arab-iptv/main/filtered_file_05.01.25.m3u',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Ustream (ktkooot1) — Arabic sports & entertainment packs
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ustream',
    name: 'Ustream',
    description: 'Arabic sports & entertainment packs by ktkooot1',
    flag: '👥',
    categories: [
      {
        id: 'bein',
        name: 'beIN Sports',
        flag: '⚽',
        playlists: [
          { id: 'ktk-bein-max', name: 'beIN Sports Max', flag: '⚽', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/BEIN%20SPORTS%20MAX.m3u' },
          { id: 'ktk-bein-2025', name: 'beIN Sports 2025', flag: '⚽', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Beinsport%202025.6.11.m3u' },
        ],
      },
      {
        id: 'sports-packs',
        name: 'Sports Packs',
        flag: '🏆',
        playlists: [
          { id: 'ktk-blue-sport', name: 'Blue Sport', flag: '🔵', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Blue%20Sport.m3u' },
          { id: 'ktk-ch-sport', name: 'CH Sport', flag: '⚽', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/CH%20Sport.m3u' },
          { id: 'ktk-faster-sport', name: 'Faster Sport', flag: '⚡', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Faster%20Sport.m3u' },
          { id: 'ktk-forever-sport', name: 'Forever Sport', flag: '♾️', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Forever%20Sport.m3u' },
          { id: 'ktk-fun-sport', name: 'Fun Sport', flag: '🎯', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Fun%20Sport.m3u' },
          { id: 'ktk-ghazal-sport', name: 'Ghazal Sport', flag: '🦌', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Ghazal%20Sport.m3u' },
          { id: 'ktk-go-sport', name: 'Go Sport', flag: '🏁', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Go%20Sport.m3u' },
          { id: 'ktk-novavod-sport', name: 'NOVAVOD Sport', flag: '🆕', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/NOVAVOD%20Sport.m3u' },
          { id: 'ktk-novaa-sport', name: 'Novaa Sport', flag: '🆕', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Novaa%20Sport.m3u' },
          { id: 'ktk-sdk-sport', name: 'SDK Sport', flag: '⚽', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/SDK%20SPORT.m3u' },
          { id: 'ktk-showplus-sport', name: 'Showplus Sport', flag: '➕', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Showplus%20Sport.m3u' },
          { id: 'ktk-sport-my-tv', name: 'Sport My TV', flag: '🏆', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Sport%20My%20TV.m3u' },
          { id: 'ktk-top-sport', name: 'Top Sport', flag: '🔝', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Top%20Sport%20(1).m3u' },
          { id: 'ktk-vip-sport', name: 'VIP Sport', flag: '💎', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/VIP%20SPORT.m3u' },
          { id: 'ktk-venus-sport', name: 'Venus Sport', flag: '🌟', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Venus%20Sport.m3u' },
        ],
      },
      {
        id: 'entertainment',
        name: 'Entertainment',
        flag: '📺',
        playlists: [
          { id: 'ktk-alwan', name: 'Alwan Channels', flag: '🌈', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/ALWAN%20CHANNELS_20260623_230126.m3u' },
          { id: 'ktk-hussam-tv', name: 'Hussam TV', flag: '📺', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Hussam_TV.m3u' },
          { id: 'ktk-joker-aziz', name: 'Joker Aziz', flag: '🃏', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/JOKER%20AZIZ%20(1).m3u' },
          { id: 'ktk-karam', name: 'Karam Palestine', flag: '🇵🇸', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/KARAM%20PALSSTEN%20IPTV.M3U' },
          { id: 'ktk-ostora-tv', name: 'Ostora TV', flag: '🐉', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Ostora%20TV%20(2).m3u' },
          { id: 'ktk-yasine-tv', name: 'Yasine TV', flag: '📺', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/Yasine%20TV.m3u' },
          { id: 'ktk-bn-max-nm', name: 'bN Max NM', flag: '📦', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/bN_MAX_NM.m3u' },
          { id: 'ktk-bn-sa', name: 'bN SA', flag: '📦', url: 'https://raw.githubusercontent.com/ktkooot1/Ustream/main/bN_SA.m3u' },
        ],
      },
    ],
  },
]

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export function getProviderById(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export function getCategoryById(providerId: string, categoryId: string): ProviderCategory | undefined {
  return getProviderById(providerId)?.categories.find((c) => c.id === categoryId)
}

export function getPlaylistById(providerId: string, categoryId: string, playlistId: string): PlaylistItem | undefined {
  return getCategoryById(providerId, categoryId)?.playlists?.find((p) => p.id === playlistId)
}

/** Resolve a provider+category+playlist path to a URL */
export function resolvePlaylistUrl(providerId: string, categoryId: string, playlistId?: string): string | undefined {
  const cat = getCategoryById(providerId, categoryId)
  if (!cat) return undefined
  if (cat.directUrl) return cat.directUrl
  if (playlistId && cat.playlists) {
    const pl = cat.playlists.find((p) => p.id === playlistId)
    return pl?.url
  }
  // If category has playlists but no playlistId specified, return the first
  if (cat.playlists && cat.playlists.length > 0) return cat.playlists[0].url
  return undefined
}
