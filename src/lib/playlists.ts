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
    description: 'Pluto TV, Plex TV, Samsung TV Plus — official free channels (filtered: 731 working)',
    flag: '📺',
    categories: [
      {
        id: 'all',
        name: 'All Free-TV',
        flag: '📺',
        directUrl: '/filtered/free-tv-all.m3u',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IPTV4ON — uploaded local playlist (filtered: 165 working out of 172)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'iptv4on',
    name: 'IPTV4ON',
    description: 'Arabic, beIN Sports, France, World Cup 2026 — verified working',
    flag: '🎬',
    categories: [
      {
        id: 'all',
        name: 'All Channels',
        flag: '📺',
        directUrl: '/filtered/iptv4on-all.m3u',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // World IPTV (Romaxa55) — auto-verified every 6 hours, 14000+ working channels
  // Source: https://github.com/Romaxa55/world_ip_tv
  // Main playlist: https://romaxa55.github.io/world_ip_tv/output/index.m3u
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'world-iptv',
    name: 'World IPTV',
    description: 'Auto-verified every 6 hours — 14000+ working channels',
    flag: '✅',
    categories: [
      {
        id: 'verified-all',
        name: 'Verified (All)',
        flag: '🌐',
        directUrl: '/filtered/world-iptv-verified-all.m3u',
      },
      {
        id: 'arabic',
        name: 'Arabic Countries',
        flag: '🇸🇦',
        playlists: [
          { id: 'w-eg', name: 'Egypt', flag: '🇪🇬', url: 'https://iptv-org.github.io/iptv/countries/eg.m3u' },
          { id: 'w-sa', name: 'Saudi Arabia', flag: '🇸🇦', url: 'https://iptv-org.github.io/iptv/countries/sa.m3u' },
          { id: 'w-ae', name: 'UAE', flag: '🇦🇪', url: 'https://iptv-org.github.io/iptv/countries/ae.m3u' },
          { id: 'w-qa', name: 'Qatar', flag: '🇶🇦', url: 'https://iptv-org.github.io/iptv/countries/qa.m3u' },
          { id: 'w-kw', name: 'Kuwait', flag: '🇰🇼', url: 'https://iptv-org.github.io/iptv/countries/kw.m3u' },
          { id: 'w-bh', name: 'Bahrain', flag: '🇧🇭', url: 'https://iptv-org.github.io/iptv/countries/bh.m3u' },
          { id: 'w-om', name: 'Oman', flag: '🇴🇲', url: 'https://iptv-org.github.io/iptv/countries/om.m3u' },
          { id: 'w-ye', name: 'Yemen', flag: '🇾🇪', url: 'https://iptv-org.github.io/iptv/countries/ye.m3u' },
          { id: 'w-jo', name: 'Jordan', flag: '🇯🇴', url: 'https://iptv-org.github.io/iptv/countries/jo.m3u' },
          { id: 'w-lb', name: 'Lebanon', flag: '🇱🇧', url: 'https://iptv-org.github.io/iptv/countries/lb.m3u' },
          { id: 'w-sy', name: 'Syria', flag: '🇸🇾', url: 'https://iptv-org.github.io/iptv/countries/sy.m3u' },
          { id: 'w-iq', name: 'Iraq', flag: '🇮🇶', url: 'https://iptv-org.github.io/iptv/countries/iq.m3u' },
          { id: 'w-ps', name: 'Palestine', flag: '🇵🇸', url: 'https://iptv-org.github.io/iptv/countries/ps.m3u' },
          { id: 'w-sd', name: 'Sudan', flag: '🇸🇩', url: 'https://iptv-org.github.io/iptv/countries/sd.m3u' },
          { id: 'w-ly', name: 'Libya', flag: '🇱🇾', url: 'https://iptv-org.github.io/iptv/countries/ly.m3u' },
          { id: 'w-tn', name: 'Tunisia', flag: '🇹🇳', url: 'https://iptv-org.github.io/iptv/countries/tn.m3u' },
          { id: 'w-dz', name: 'Algeria', flag: '🇩🇿', url: 'https://iptv-org.github.io/iptv/countries/dz.m3u' },
          { id: 'w-ma', name: 'Morocco', flag: '🇲🇦', url: 'https://iptv-org.github.io/iptv/countries/ma.m3u' },
          { id: 'w-mr', name: 'Mauritania', flag: '🇲🇷', url: 'https://iptv-org.github.io/iptv/countries/mr.m3u' },
          { id: 'w-so', name: 'Somalia', flag: '🇸🇴', url: 'https://iptv-org.github.io/iptv/countries/so.m3u' },
        ],
      },
      {
        id: 'middle-east',
        name: 'Middle East',
        flag: '🕌',
        playlists: [
          { id: 'w-ir', name: 'Iran', flag: '🇮🇷', url: 'https://iptv-org.github.io/iptv/countries/ir.m3u' },
          { id: 'w-tr', name: 'Turkey', flag: '🇹🇷', url: 'https://iptv-org.github.io/iptv/countries/tr.m3u' },
          { id: 'w-il', name: 'Israel', flag: '🇮🇱', url: 'https://iptv-org.github.io/iptv/countries/il.m3u' },
          { id: 'w-af', name: 'Afghanistan', flag: '🇦🇫', url: 'https://iptv-org.github.io/iptv/countries/af.m3u' },
          { id: 'w-pk', name: 'Pakistan', flag: '🇵🇰', url: 'https://iptv-org.github.io/iptv/countries/pk.m3u' },
        ],
      },
      {
        id: 'world',
        name: 'World Countries',
        flag: '🗺️',
        playlists: [
          { id: 'w-us', name: 'USA', flag: '🇺🇸', url: 'https://iptv-org.github.io/iptv/countries/us.m3u' },
          { id: 'w-uk', name: 'UK', flag: '🇬🇧', url: 'https://iptv-org.github.io/iptv/countries/uk.m3u' },
          { id: 'w-ca', name: 'Canada', flag: '🇨🇦', url: 'https://iptv-org.github.io/iptv/countries/ca.m3u' },
          { id: 'w-fr', name: 'France', flag: '🇫🇷', url: 'https://iptv-org.github.io/iptv/countries/fr.m3u' },
          { id: 'w-de', name: 'Germany', flag: '🇩🇪', url: 'https://iptv-org.github.io/iptv/countries/de.m3u' },
          { id: 'w-es', name: 'Spain', flag: '🇪🇸', url: 'https://iptv-org.github.io/iptv/countries/es.m3u' },
          { id: 'w-it', name: 'Italy', flag: '🇮🇹', url: 'https://iptv-org.github.io/iptv/countries/it.m3u' },
          { id: 'w-ru', name: 'Russia', flag: '🇷🇺', url: 'https://iptv-org.github.io/iptv/countries/ru.m3u' },
          { id: 'w-in', name: 'India', flag: '🇮🇳', url: 'https://iptv-org.github.io/iptv/countries/in.m3u' },
          { id: 'w-cn', name: 'China', flag: '🇨🇳', url: 'https://iptv-org.github.io/iptv/countries/cn.m3u' },
          { id: 'w-jp', name: 'Japan', flag: '🇯🇵', url: 'https://iptv-org.github.io/iptv/countries/jp.m3u' },
          { id: 'w-kr', name: 'Korea', flag: '🇰🇷', url: 'https://iptv-org.github.io/iptv/countries/kr.m3u' },
          { id: 'w-br', name: 'Brazil', flag: '🇧🇷', url: 'https://iptv-org.github.io/iptv/countries/br.m3u' },
          { id: 'w-mx', name: 'Mexico', flag: '🇲🇽', url: 'https://iptv-org.github.io/iptv/countries/mx.m3u' },
          { id: 'w-ar', name: 'Argentina', flag: '🇦🇷', url: 'https://iptv-org.github.io/iptv/countries/ar.m3u' },
          { id: 'w-cl', name: 'Chile', flag: '🇨🇱', url: 'https://iptv-org.github.io/iptv/countries/cl.m3u' },
          { id: 'w-pe', name: 'Peru', flag: '🇵🇪', url: 'https://iptv-org.github.io/iptv/countries/pe.m3u' },
          { id: 'w-do', name: 'Dominican Rep.', flag: '🇩🇴', url: 'https://iptv-org.github.io/iptv/countries/do.m3u' },
          { id: 'w-nl', name: 'Netherlands', flag: '🇳🇱', url: 'https://iptv-org.github.io/iptv/countries/nl.m3u' },
          { id: 'w-ng', name: 'Nigeria', flag: '🇳🇬', url: 'https://iptv-org.github.io/iptv/countries/ng.m3u' },
          { id: 'w-za', name: 'South Africa', flag: '🇿🇦', url: 'https://iptv-org.github.io/iptv/countries/za.m3u' },
        ],
      },
      {
        id: 'genres',
        name: 'By Genre',
        flag: '🎬',
        playlists: [
          { id: 'w-sports', name: 'Sports', flag: '⚽', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
          { id: 'w-news', name: 'News', flag: '📰', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
          { id: 'w-movies', name: 'Movies', flag: '🎬', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
          { id: 'w-music', name: 'Music', flag: '🎵', url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
          { id: 'w-kids', name: 'Kids', flag: '👶', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
          { id: 'w-entertainment', name: 'Entertainment', flag: '🎪', url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u' },
          { id: 'w-documentary', name: 'Documentary', flag: '🔬', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' },
          { id: 'w-religious', name: 'Religious', flag: '🕌', url: 'https://iptv-org.github.io/iptv/categories/religious.m3u' },
          { id: 'w-education', name: 'Education', flag: '🎓', url: 'https://iptv-org.github.io/iptv/categories/education.m3u' },
          { id: 'w-culture', name: 'Culture', flag: '🏛️', url: 'https://iptv-org.github.io/iptv/categories/culture.m3u' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IPTV Streams (iptv-org/iptv/streams/) — raw per-country source playlists
  // Source: https://github.com/iptv-org/iptv/tree/master/streams
  // These are the raw source files that get aggregated into the countries/*.m3u
  // playlists. The streams/ directory also includes special sub-source variants
  // (Pluto TV, Samsung TV Plus, Rakuten, CCTV, etc.) that aren't in the
  // countries/ folder — these are unique to this provider.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'iptv-streams',
    name: 'IPTV Streams',
    description: 'Raw per-country source streams from iptv-org/iptv/streams/',
    flag: '📡',
    categories: [
      {
        id: 'countries',
        name: 'By Country',
        flag: '🗺️',
        playlists: [
          { id: 's-eg', name: 'Egypt', flag: '🇪🇬', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/eg.m3u' },
          { id: 's-sa', name: 'Saudi Arabia', flag: '🇸🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sa.m3u' },
          { id: 's-ae', name: 'UAE', flag: '🇦🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ae.m3u' },
          { id: 's-qa', name: 'Qatar', flag: '🇶🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/qa.m3u' },
          { id: 's-kw', name: 'Kuwait', flag: '🇰🇼', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/kw.m3u' },
          { id: 's-bh', name: 'Bahrain', flag: '🇧🇭', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/bh.m3u' },
          { id: 's-om', name: 'Oman', flag: '🇴🇲', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/om.m3u' },
          { id: 's-ye', name: 'Yemen', flag: '🇾🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ye.m3u' },
          { id: 's-jo', name: 'Jordan', flag: '🇯🇴', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/jo.m3u' },
          { id: 's-lb', name: 'Lebanon', flag: '🇱🇧', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/lb.m3u' },
          { id: 's-sy', name: 'Syria', flag: '🇸🇾', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sy.m3u' },
          { id: 's-iq', name: 'Iraq', flag: '🇮🇶', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/iq.m3u' },
          { id: 's-ps', name: 'Palestine', flag: '🇵🇸', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ps.m3u' },
          { id: 's-sd', name: 'Sudan', flag: '🇸🇩', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sd.m3u' },
          { id: 's-ly', name: 'Libya', flag: '🇱🇾', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ly.m3u' },
          { id: 's-tn', name: 'Tunisia', flag: '🇹🇳', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tn.m3u' },
          { id: 's-dz', name: 'Algeria', flag: '🇩🇿', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/dz.m3u' },
          { id: 's-ma', name: 'Morocco', flag: '🇲🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ma.m3u' },
          { id: 's-mr', name: 'Mauritania', flag: '🇲🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/mr.m3u' },
          { id: 's-so', name: 'Somalia', flag: '🇸🇴', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/so.m3u' },
          { id: 's-ir', name: 'Iran', flag: '🇮🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ir.m3u' },
          { id: 's-tr', name: 'Turkey', flag: '🇹🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tr.m3u' },
          { id: 's-il', name: 'Israel', flag: '🇮🇱', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/il.m3u' },
          { id: 's-af', name: 'Afghanistan', flag: '🇦🇫', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/af.m3u' },
          { id: 's-pk', name: 'Pakistan', flag: '🇵🇰', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pk.m3u' },
          { id: 's-us', name: 'USA', flag: '🇺🇸', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u' },
          { id: 's-uk', name: 'UK', flag: '🇬🇧', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk.m3u' },
          { id: 's-ca', name: 'Canada', flag: '🇨🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca.m3u' },
          { id: 's-fr', name: 'France', flag: '🇫🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr.m3u' },
          { id: 's-de', name: 'Germany', flag: '🇩🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de.m3u' },
          { id: 's-es', name: 'Spain', flag: '🇪🇸', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es.m3u' },
          { id: 's-it', name: 'Italy', flag: '🇮🇹', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/it.m3u' },
          { id: 's-ru', name: 'Russia', flag: '🇷🇺', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ru.m3u' },
          { id: 's-in', name: 'India', flag: '🇮🇳', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u' },
          { id: 's-cn', name: 'China', flag: '🇨🇳', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/cn.m3u' },
          { id: 's-jp', name: 'Japan', flag: '🇯🇵', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/jp.m3u' },
          { id: 's-kr', name: 'Korea', flag: '🇰🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/kr.m3u' },
          { id: 's-br', name: 'Brazil', flag: '🇧🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br.m3u' },
          { id: 's-mx', name: 'Mexico', flag: '🇲🇽', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/mx.m3u' },
          { id: 's-ar', name: 'Argentina', flag: '🇦🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u' },
          { id: 's-cl', name: 'Chile', flag: '🇨🇱', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/cl.m3u' },
          { id: 's-se', name: 'Sweden', flag: '🇸🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/se.m3u' },
          { id: 's-nl', name: 'Netherlands', flag: '🇳🇱', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/nl.m3u' },
          { id: 's-pl', name: 'Poland', flag: '🇵🇱', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pl.m3u' },
          { id: 's-za', name: 'South Africa', flag: '🇿🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/za.m3u' },
          { id: 's-ng', name: 'Nigeria', flag: '🇳🇬', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ng.m3u' },
        ],
      },
      {
        id: 'pluto-tv',
        name: 'Pluto TV',
        flag: '🆓',
        playlists: [
          { id: 's-us-pluto', name: 'Pluto TV USA', flag: '🇺🇸', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_pluto.m3u' },
          { id: 's-uk-pluto', name: 'Pluto TV UK', flag: '🇬🇧', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk_pluto.m3u' },
          { id: 's-at-pluto', name: 'Pluto TV Austria', flag: '🇦🇹', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/at_pluto.m3u' },
          { id: 's-br-pluto', name: 'Pluto TV Brazil', flag: '🇧🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br_pluto.m3u' },
          { id: 's-ca-pluto', name: 'Pluto TV Canada', flag: '🇨🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca_pluto.m3u' },
          { id: 's-ch-pluto', name: 'Pluto TV Switzerland', flag: '🇨🇭', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ch_pluto.m3u' },
          { id: 's-de-pluto', name: 'Pluto TV Germany', flag: '🇩🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de_pluto.m3u' },
          { id: 's-dk-pluto', name: 'Pluto TV Denmark', flag: '🇩🇰', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/dk_pluto.m3u' },
          { id: 's-es-pluto', name: 'Pluto TV Spain', flag: '🇪🇸', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es_pluto.m3u' },
          { id: 's-fr-pluto', name: 'Pluto TV France', flag: '🇫🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_pluto.m3u' },
          { id: 's-it-pluto', name: 'Pluto TV Italy', flag: '🇮🇹', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/it_pluto.m3u' },
          { id: 's-se-pluto', name: 'Pluto TV Sweden', flag: '🇸🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/se_pluto.m3u' },
        ],
      },
      {
        id: 'samsung-tv',
        name: 'Samsung TV Plus',
        flag: '📱',
        playlists: [
          { id: 's-us-samsung', name: 'Samsung TV USA (252✓)', flag: '🇺🇸', url: '/filtered/iptv-streams-samsung-tv-us-samsung.m3u' },
          { id: 's-uk-samsung', name: 'Samsung TV UK (120✓)', flag: '🇬🇧', url: '/filtered/iptv-streams-samsung-tv-uk-samsung.m3u' },
          { id: 's-at-samsung', name: 'Samsung TV Austria', flag: '🇦🇹', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/at_samsung.m3u' },
          { id: 's-au-samsung', name: 'Samsung TV Australia', flag: '🇦🇺', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/au_samsung.m3u' },
          { id: 's-be-samsung', name: 'Samsung TV Belgium', flag: '🇧🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/be_samsung.m3u' },
          { id: 's-br-samsung', name: 'Samsung TV Brazil', flag: '🇧🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br_samsung.m3u' },
          { id: 's-ca-samsung', name: 'Samsung TV Canada', flag: '🇨🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca_samsung.m3u' },
          { id: 's-ch-samsung', name: 'Samsung TV Switzerland', flag: '🇨🇭', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ch_samsung.m3u' },
          { id: 's-de-samsung', name: 'Samsung TV Germany (1✓)', flag: '🇩🇪', url: '/filtered/iptv-streams-samsung-tv-de-samsung.m3u' },
          { id: 's-dk-samsung', name: 'Samsung TV Denmark', flag: '🇩🇰', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/dk_samsung.m3u' },
          { id: 's-es-samsung', name: 'Samsung TV Spain', flag: '🇪🇸', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es_samsung.m3u' },
          { id: 's-fi-samsung', name: 'Samsung TV Finland', flag: '🇫🇮', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fi_samsung.m3u' },
          { id: 's-fr-samsung', name: 'Samsung TV France', flag: '🇫🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_samsung.m3u' },
          { id: 's-it-samsung', name: 'Samsung TV Italy', flag: '🇮🇹', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/it_samsung.m3u' },
          { id: 's-se-samsung', name: 'Samsung TV Sweden', flag: '🇸🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/se_samsung.m3u' },
        ],
      },
      {
        id: 'special',
        name: 'Special Sources',
        flag: '⭐',
        playlists: [
          { id: 's-cn-cctv', name: 'CCTV (China)', flag: '🇨🇳', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/cn_cctv.m3u' },
          { id: 's-cn-cgtn', name: 'CGTN (China Global)', flag: '🌍', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/cn_cgtn.m3u' },
          { id: 's-cn-112114', name: '112114 (China)', flag: '🇨🇳', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/cn_112114.m3u' },
          { id: 's-cn-yeslivetv', name: 'YesLiveTV (China)', flag: '🇨🇳', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/cn_yeslivetv.m3u' },
          { id: 's-ca-stingray', name: 'Stingray (Canada)', flag: '🇨🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca_stingray.m3u' },
          { id: 's-ba-morescreens', name: 'MoreScreens (Bosnia)', flag: '🇧🇦', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ba_morescreens.m3u' },
          { id: 's-bz-nexgen', name: 'NexGen (Belize)', flag: '🇧🇿', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/bz_nexgen.m3u' },
          { id: 's-fr-bfm', name: 'BFM (France)', flag: '🇫🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_bfm.m3u' },
          { id: 's-fr-fashiontv', name: 'FashionTV (France)', flag: '👗', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_fashiontv.m3u' },
          { id: 's-fr-groupecanalplus', name: 'Canal+ Group (France)', flag: '🇫🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_groupecanalplus.m3u' },
          { id: 's-fr-groupem6', name: 'M6 Group (France)', flag: '🇫🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_groupem6.m3u' },
          { id: 's-fr-persiana', name: 'Persiana (France)', flag: '🇫🇷', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_persiana.m3u' },
          { id: 's-de-rakuten', name: 'Rakuten (Germany)', flag: '🇩🇪', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de_rakuten.m3u' },
          { id: 's-es-rakuten', name: 'Rakuten (Spain)', flag: '🇪🇸', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es_rakuten.m3u' },
          { id: 's-es-yowi', name: 'Yowi (Spain)', flag: '🇪🇸', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es_yowi.m3u' },
          { id: 's-fi-rakuten', name: 'Rakuten (Finland)', flag: '🇫🇮', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fi_rakuten.m3u' },
          { id: 's-it-rakuten', name: 'Rakuten (Italy)', flag: '🇮🇹', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/it_rakuten.m3u' },
          { id: 's-pl-rakuten', name: 'Rakuten (Poland)', flag: '🇵🇱', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pl_rakuten.m3u' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // beIN Sports — VERIFIED WORKING streams only
  // Every URL in the "Verified Working" category has been tested with a stream
  // checker (HTTP GET + HLS manifest + variant + .ts segment validation) and
  // confirmed working as of the last check.
  //
  // The 7 community playlists from GitHub gists were all tested and found to
  // contain only MAC-locked subscription portals (0 working channels across
  // 270+ beIN-branded entries). They have been removed.
  //
  // The only genuinely free, working beIN streams are:
  // - beIN Sports XTRA (US, English) — 2 sources
  // - beIN Sports XTRA Ñ (US, Spanish) — 3 sources
  // - beIN Sports Haber (Turkey) — 1 source
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'bein-community',
    name: 'beIN Sports',
    description: 'Verified working beIN streams — tested before adding',
    flag: '⚽',
    categories: [
      {
        id: 'verified',
        name: 'Verified Working',
        flag: '✅',
        directUrl: '/filtered/bein-verified.m3u',
      },
      {
        id: 'iptv-org-sports',
        name: 'iptv-org Sports',
        flag: '🌐',
        directUrl: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
      },
      {
        id: 'world-verified',
        name: 'World IPTV Verified',
        flag: '🌍',
        directUrl: 'https://romaxa55.github.io/world_ip_tv/output/index.m3u',
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
