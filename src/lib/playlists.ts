// Pre-loaded M3U playlist sources
// Sources: iptv-org project (https://github.com/iptv-org/iptv)
//          Free-TV project (https://github.com/Free-TV/IPTV)
//          rhythm98/iptv-vlc fork (https://github.com/rhythm98/iptv-vlc)
// All public, free, legal playlists. Country-specific playlists tend to have
// a much higher ratio of working channels than the giant global index.

export type PlaylistCategory =
  | 'featured'
  | 'arabic'
  | 'middle-east'
  | 'europe'
  | 'americas'
  | 'asia'
  | 'africa'
  | 'category'
  | 'curated'

export type PlaylistSource = {
  id: string
  name: string
  description: string
  url: string
  category: PlaylistCategory
  flag?: string
  /** Higher priority sources appear first */
  priority?: number
}

export const PLAYLIST_SOURCES: PlaylistSource[] = [
  // ─── Featured (most popular) ──────────────────────────────────────────────
  {
    id: 'arabic',
    name: 'Arabic (All)',
    description: 'All Arabic-language channels',
    url: 'https://iptv-org.github.io/iptv/languages/ara.m3u',
    category: 'featured',
    flag: '🇸🇦',
    priority: 100,
  },
  {
    id: 'global',
    name: 'Global (8000+)',
    description: 'Complete worldwide index',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    category: 'featured',
    flag: '🌍',
    priority: 90,
  },
  {
    id: 'free-tv',
    name: 'Free-TV (Pluto/Plex/Samsung)',
    description: 'Official free channels — high reliability',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    category: 'featured',
    flag: '📺',
    priority: 95,
  },

  // ─── Arabic country-specific (much higher working ratio) ──────────────────
  { id: 'eg', name: 'Egypt', description: 'Egyptian channels', url: 'https://iptv-org.github.io/iptv/countries/eg.m3u', category: 'arabic', flag: '🇪🇬', priority: 80 },
  { id: 'sa', name: 'Saudi Arabia', description: 'Saudi channels', url: 'https://iptv-org.github.io/iptv/countries/sa.m3u', category: 'arabic', flag: '🇸🇦', priority: 80 },
  { id: 'ae', name: 'UAE', description: 'United Arab Emirates channels', url: 'https://iptv-org.github.io/iptv/countries/ae.m3u', category: 'arabic', flag: '🇦🇪', priority: 80 },
  { id: 'qa', name: 'Qatar', description: 'Qatari channels (incl. Al Jazeera)', url: 'https://iptv-org.github.io/iptv/countries/qa.m3u', category: 'arabic', flag: '🇶🇦', priority: 75 },
  { id: 'kw', name: 'Kuwait', description: 'Kuwaiti channels', url: 'https://iptv-org.github.io/iptv/countries/kw.m3u', category: 'arabic', flag: '🇰🇼', priority: 70 },
  { id: 'bh', name: 'Bahrain', description: 'Bahraini channels', url: 'https://iptv-org.github.io/iptv/countries/bh.m3u', category: 'arabic', flag: '🇧🇭', priority: 65 },
  { id: 'om', name: 'Oman', description: 'Omani channels', url: 'https://iptv-org.github.io/iptv/countries/om.m3u', category: 'arabic', flag: '🇴🇲', priority: 65 },
  { id: 'ye', name: 'Yemen', description: 'Yemeni channels', url: 'https://iptv-org.github.io/iptv/countries/ye.m3u', category: 'arabic', flag: '🇾🇪', priority: 60 },
  { id: 'jo', name: 'Jordan', description: 'Jordanian channels', url: 'https://iptv-org.github.io/iptv/countries/jo.m3u', category: 'arabic', flag: '🇯🇴', priority: 70 },
  { id: 'lb', name: 'Lebanon', description: 'Lebanese channels', url: 'https://iptv-org.github.io/iptv/countries/lb.m3u', category: 'arabic', flag: '🇱🇧', priority: 75 },
  { id: 'sy', name: 'Syria', description: 'Syrian channels', url: 'https://iptv-org.github.io/iptv/countries/sy.m3u', category: 'arabic', flag: '🇸🇾', priority: 65 },
  { id: 'iq', name: 'Iraq', description: 'Iraqi channels', url: 'https://iptv-org.github.io/iptv/countries/iq.m3u', category: 'arabic', flag: '🇮🇶', priority: 70 },
  { id: 'ps', name: 'Palestine', description: 'Palestinian channels', url: 'https://iptv-org.github.io/iptv/countries/ps.m3u', category: 'arabic', flag: '🇵🇸', priority: 65 },
  { id: 'sd', name: 'Sudan', description: 'Sudanese channels', url: 'https://iptv-org.github.io/iptv/countries/sd.m3u', category: 'arabic', flag: '🇸🇩', priority: 60 },
  { id: 'ly', name: 'Libya', description: 'Libyan channels', url: 'https://iptv-org.github.io/iptv/countries/ly.m3u', category: 'arabic', flag: '🇱🇾', priority: 60 },
  { id: 'tn', name: 'Tunisia', description: 'Tunisian channels', url: 'https://iptv-org.github.io/iptv/countries/tn.m3u', category: 'arabic', flag: '🇹🇳', priority: 70 },
  { id: 'dz', name: 'Algeria', description: 'Algerian channels', url: 'https://iptv-org.github.io/iptv/countries/dz.m3u', category: 'arabic', flag: '🇩🇿', priority: 70 },
  { id: 'ma', name: 'Morocco', description: 'Moroccan channels', url: 'https://iptv-org.github.io/iptv/countries/ma.m3u', category: 'arabic', flag: '🇲🇦', priority: 75 },
  { id: 'mr', name: 'Mauritania', description: 'Mauritanian channels', url: 'https://iptv-org.github.io/iptv/countries/mr.m3u', category: 'arabic', flag: '🇲🇷', priority: 55 },
  { id: 'so', name: 'Somalia', description: 'Somali channels', url: 'https://iptv-org.github.io/iptv/countries/so.m3u', category: 'arabic', flag: '🇸🇴', priority: 55 },
  { id: 'dj', name: 'Djibouti', description: 'Djiboutian channels', url: 'https://iptv-org.github.io/iptv/countries/dj.m3u', category: 'arabic', flag: '🇩🇯', priority: 50 },
  { id: 'km', name: 'Comoros', description: 'Comorian channels', url: 'https://iptv-org.github.io/iptv/countries/km.m3u', category: 'arabic', flag: '🇰🇲', priority: 45 },

  // ─── Middle East / Iran / Turkey / Israel ─────────────────────────────────
  { id: 'ir', name: 'Iran', description: 'Iranian channels (Persian)', url: 'https://iptv-org.github.io/iptv/countries/ir.m3u', category: 'middle-east', flag: '🇮🇷', priority: 75 },
  { id: 'tr', name: 'Turkey', description: 'Turkish channels', url: 'https://iptv-org.github.io/iptv/countries/tr.m3u', category: 'middle-east', flag: '🇹🇷', priority: 80 },
  { id: 'il', name: 'Israel', description: 'Israeli channels', url: 'https://iptv-org.github.io/iptv/countries/il.m3u', category: 'middle-east', flag: '🇮🇱', priority: 70 },
  { id: 'ps-he', name: 'Hebrew', description: 'All Hebrew-language channels', url: 'https://iptv-org.github.io/iptv/languages/heb.m3u', category: 'middle-east', flag: '🕎', priority: 60 },
  { id: 'fa', name: 'Persian', description: 'All Persian-language channels', url: 'https://iptv-org.github.io/iptv/languages/per.m3u', category: 'middle-east', flag: '🟢', priority: 65 },
  { id: 'ku', name: 'Kurdish', description: 'All Kurdish-language channels', url: 'https://iptv-org.github.io/iptv/languages/kur.m3u', category: 'middle-east', flag: '☀️', priority: 55 },

  // ─── Europe ───────────────────────────────────────────────────────────────
  { id: 'uk', name: 'United Kingdom', description: 'UK channels', url: 'https://iptv-org.github.io/iptv/countries/uk.m3u', category: 'europe', flag: '🇬🇧', priority: 75 },
  { id: 'fr', name: 'France', description: 'French channels', url: 'https://iptv-org.github.io/iptv/countries/fr.m3u', category: 'europe', flag: '🇫🇷', priority: 75 },
  { id: 'de', name: 'Germany', description: 'German channels', url: 'https://iptv-org.github.io/iptv/countries/de.m3u', category: 'europe', flag: '🇩🇪', priority: 75 },
  { id: 'es', name: 'Spain', description: 'Spanish channels', url: 'https://iptv-org.github.io/iptv/countries/es.m3u', category: 'europe', flag: '🇪🇸', priority: 70 },
  { id: 'it', name: 'Italy', description: 'Italian channels', url: 'https://iptv-org.github.io/iptv/countries/it.m3u', category: 'europe', flag: '🇮🇹', priority: 70 },
  { id: 'pt', name: 'Portugal', description: 'Portuguese channels', url: 'https://iptv-org.github.io/iptv/countries/pt.m3u', category: 'europe', flag: '🇵🇹', priority: 65 },
  { id: 'nl', name: 'Netherlands', description: 'Dutch channels', url: 'https://iptv-org.github.io/iptv/countries/nl.m3u', category: 'europe', flag: '🇳🇱', priority: 65 },
  { id: 'be', name: 'Belgium', description: 'Belgian channels', url: 'https://iptv-org.github.io/iptv/countries/be.m3u', category: 'europe', flag: '🇧🇪', priority: 60 },
  { id: 'ch', name: 'Switzerland', description: 'Swiss channels', url: 'https://iptv-org.github.io/iptv/countries/ch.m3u', category: 'europe', flag: '🇨🇭', priority: 60 },
  { id: 'at', name: 'Austria', description: 'Austrian channels', url: 'https://iptv-org.github.io/iptv/countries/at.m3u', category: 'europe', flag: '🇦🇹', priority: 60 },
  { id: 'se', name: 'Sweden', description: 'Swedish channels', url: 'https://iptv-org.github.io/iptv/countries/se.m3u', category: 'europe', flag: '🇸🇪', priority: 60 },
  { id: 'no', name: 'Norway', description: 'Norwegian channels', url: 'https://iptv-org.github.io/iptv/countries/no.m3u', category: 'europe', flag: '🇳🇴', priority: 60 },
  { id: 'dk', name: 'Denmark', description: 'Danish channels', url: 'https://iptv-org.github.io/iptv/countries/dk.m3u', category: 'europe', flag: '🇩🇰', priority: 60 },
  { id: 'fi', name: 'Finland', description: 'Finnish channels', url: 'https://iptv-org.github.io/iptv/countries/fi.m3u', category: 'europe', flag: '🇫🇮', priority: 60 },
  { id: 'pl', name: 'Poland', description: 'Polish channels', url: 'https://iptv-org.github.io/iptv/countries/pl.m3u', category: 'europe', flag: '🇵🇱', priority: 65 },
  { id: 'ru', name: 'Russia', description: 'Russian channels', url: 'https://iptv-org.github.io/iptv/countries/ru.m3u', category: 'europe', flag: '🇷🇺', priority: 70 },
  { id: 'ua', name: 'Ukraine', description: 'Ukrainian channels', url: 'https://iptv-org.github.io/iptv/countries/ua.m3u', category: 'europe', flag: '🇺🇦', priority: 65 },
  { id: 'gr', name: 'Greece', description: 'Greek channels', url: 'https://iptv-org.github.io/iptv/countries/gr.m3u', category: 'europe', flag: '🇬🇷', priority: 65 },
  { id: 'ro', name: 'Romania', description: 'Romanian channels', url: 'https://iptv-org.github.io/iptv/countries/ro.m3u', category: 'europe', flag: '🇷🇴', priority: 60 },
  { id: 'cz', name: 'Czechia', description: 'Czech channels', url: 'https://iptv-org.github.io/iptv/countries/cz.m3u', category: 'europe', flag: '🇨🇿', priority: 60 },
  { id: 'hu', name: 'Hungary', description: 'Hungarian channels', url: 'https://iptv-org.github.io/iptv/countries/hu.m3u', category: 'europe', flag: '🇭🇺', priority: 60 },
  { id: 'bg', name: 'Bulgaria', description: 'Bulgarian channels', url: 'https://iptv-org.github.io/iptv/countries/bg.m3u', category: 'europe', flag: '🇧🇬', priority: 55 },
  { id: 'rs', name: 'Serbia', description: 'Serbian channels', url: 'https://iptv-org.github.io/iptv/countries/rs.m3u', category: 'europe', flag: '🇷🇸', priority: 55 },
  { id: 'hr', name: 'Croatia', description: 'Croatian channels', url: 'https://iptv-org.github.io/iptv/countries/hr.m3u', category: 'europe', flag: '🇭🇷', priority: 55 },
  { id: 'ie', name: 'Ireland', description: 'Irish channels', url: 'https://iptv-org.github.io/iptv/countries/ie.m3u', category: 'europe', flag: '🇮🇪', priority: 60 },

  // ─── Americas ─────────────────────────────────────────────────────────────
  { id: 'us', name: 'United States', description: 'US channels', url: 'https://iptv-org.github.io/iptv/countries/us.m3u', category: 'americas', flag: '🇺🇸', priority: 85 },
  { id: 'ca', name: 'Canada', description: 'Canadian channels', url: 'https://iptv-org.github.io/iptv/countries/ca.m3u', category: 'americas', flag: '🇨🇦', priority: 70 },
  { id: 'mx', name: 'Mexico', description: 'Mexican channels', url: 'https://iptv-org.github.io/iptv/countries/mx.m3u', category: 'americas', flag: '🇲🇽', priority: 70 },
  { id: 'br', name: 'Brazil', description: 'Brazilian channels', url: 'https://iptv-org.github.io/iptv/countries/br.m3u', category: 'americas', flag: '🇧🇷', priority: 70 },
  { id: 'ar', name: 'Argentina', description: 'Argentine channels', url: 'https://iptv-org.github.io/iptv/countries/ar.m3u', category: 'americas', flag: '🇦🇷', priority: 65 },
  { id: 'co', name: 'Colombia', description: 'Colombian channels', url: 'https://iptv-org.github.io/iptv/countries/co.m3u', category: 'americas', flag: '🇨🇴', priority: 60 },
  { id: 'cl', name: 'Chile', description: 'Chilean channels', url: 'https://iptv-org.github.io/iptv/countries/cl.m3u', category: 'americas', flag: '🇨🇱', priority: 60 },
  { id: 'pe', name: 'Peru', description: 'Peruvian channels', url: 'https://iptv-org.github.io/iptv/countries/pe.m3u', category: 'americas', flag: '🇵🇪', priority: 55 },
  { id: 've', name: 'Venezuela', description: 'Venezuelan channels', url: 'https://iptv-org.github.io/iptv/countries/ve.m3u', category: 'americas', flag: '🇻🇪', priority: 55 },
  { id: 'es-mx', name: 'Spanish (LatAm)', description: 'All Spanish-language channels', url: 'https://iptv-org.github.io/iptv/languages/spa.m3u', category: 'americas', flag: '🌎', priority: 75 },
  { id: 'pt-br', name: 'Portuguese', description: 'All Portuguese-language channels', url: 'https://iptv-org.github.io/iptv/languages/por.m3u', category: 'americas', flag: '🟢', priority: 65 },

  // ─── Asia ─────────────────────────────────────────────────────────────────
  { id: 'in', name: 'India', description: 'Indian channels', url: 'https://iptv-org.github.io/iptv/countries/in.m3u', category: 'asia', flag: '🇮🇳', priority: 80 },
  { id: 'pk', name: 'Pakistan', description: 'Pakistani channels', url: 'https://iptv-org.github.io/iptv/countries/pk.m3u', category: 'asia', flag: '🇵🇰', priority: 70 },
  { id: 'bd', name: 'Bangladesh', description: 'Bangladeshi channels', url: 'https://iptv-org.github.io/iptv/countries/bd.m3u', category: 'asia', flag: '🇧🇩', priority: 65 },
  { id: 'cn', name: 'China', description: 'Chinese channels', url: 'https://iptv-org.github.io/iptv/countries/cn.m3u', category: 'asia', flag: '🇨🇳', priority: 70 },
  { id: 'hk', name: 'Hong Kong', description: 'Hong Kong channels', url: 'https://iptv-org.github.io/iptv/countries/hk.m3u', category: 'asia', flag: '🇭🇰', priority: 60 },
  { id: 'tw', name: 'Taiwan', description: 'Taiwanese channels', url: 'https://iptv-org.github.io/iptv/countries/tw.m3u', category: 'asia', flag: '🇹🇼', priority: 60 },
  { id: 'jp', name: 'Japan', description: 'Japanese channels', url: 'https://iptv-org.github.io/iptv/countries/jp.m3u', category: 'asia', flag: '🇯🇵', priority: 65 },
  { id: 'kr', name: 'South Korea', description: 'Korean channels', url: 'https://iptv-org.github.io/iptv/countries/kr.m3u', category: 'asia', flag: '🇰🇷', priority: 65 },
  { id: 'th', name: 'Thailand', description: 'Thai channels', url: 'https://iptv-org.github.io/iptv/countries/th.m3u', category: 'asia', flag: '🇹🇭', priority: 60 },
  { id: 'vn', name: 'Vietnam', description: 'Vietnamese channels', url: 'https://iptv-org.github.io/iptv/countries/vn.m3u', category: 'asia', flag: '🇻🇳', priority: 60 },
  { id: 'id', name: 'Indonesia', description: 'Indonesian channels', url: 'https://iptv-org.github.io/iptv/countries/id.m3u', category: 'asia', flag: '🇮🇩', priority: 60 },
  { id: 'my', name: 'Malaysia', description: 'Malaysian channels', url: 'https://iptv-org.github.io/iptv/countries/my.m3u', category: 'asia', flag: '🇲🇾', priority: 60 },
  { id: 'ph', name: 'Philippines', description: 'Philippine channels', url: 'https://iptv-org.github.io/iptv/countries/ph.m3u', category: 'asia', flag: '🇵🇭', priority: 60 },
  { id: 'sg', name: 'Singapore', description: 'Singapore channels', url: 'https://iptv-org.github.io/iptv/countries/sg.m3u', category: 'asia', flag: '🇸🇬', priority: 55 },
  { id: 'lk', name: 'Sri Lanka', description: 'Sri Lankan channels', url: 'https://iptv-org.github.io/iptv/countries/lk.m3u', category: 'asia', flag: '🇱🇰', priority: 55 },
  { id: 'af', name: 'Afghanistan', description: 'Afghan channels', url: 'https://iptv-org.github.io/iptv/countries/af.m3u', category: 'asia', flag: '🇦🇫', priority: 55 },

  // ─── Africa (non-Arab) ────────────────────────────────────────────────────
  { id: 'ng', name: 'Nigeria', description: 'Nigerian channels', url: 'https://iptv-org.github.io/iptv/countries/ng.m3u', category: 'africa', flag: '🇳🇬', priority: 60 },
  { id: 'za', name: 'South Africa', description: 'South African channels', url: 'https://iptv-org.github.io/iptv/countries/za.m3u', category: 'africa', flag: '🇿🇦', priority: 65 },
  { id: 'ke', name: 'Kenya', description: 'Kenyan channels', url: 'https://iptv-org.github.io/iptv/countries/ke.m3u', category: 'africa', flag: '🇰🇪', priority: 55 },
  { id: 'gh', name: 'Ghana', description: 'Ghanaian channels', url: 'https://iptv-org.github.io/iptv/countries/gh.m3u', category: 'africa', flag: '🇬🇭', priority: 55 },
  { id: 'et', name: 'Ethiopia', description: 'Ethiopian channels', url: 'https://iptv-org.github.io/iptv/countries/et.m3u', category: 'africa', flag: '🇪🇹', priority: 55 },
  { id: 'sn', name: 'Senegal', description: 'Senegalese channels', url: 'https://iptv-org.github.io/iptv/countries/sn.m3u', category: 'africa', flag: '🇸🇳', priority: 50 },

  // ─── Categories (iptv-org) ────────────────────────────────────────────────
  { id: 'sports', name: 'Sports', description: 'Sports channels worldwide', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', category: 'category', flag: '⚽', priority: 75 },
  { id: 'news', name: 'News', description: 'News channels worldwide', url: 'https://iptv-org.github.io/iptv/categories/news.m3u', category: 'category', flag: '📰', priority: 75 },
  { id: 'movies', name: 'Movies', description: 'Movie channels worldwide', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', category: 'category', flag: '🎬', priority: 75 },
  { id: 'music', name: 'Music', description: 'Music channels worldwide', url: 'https://iptv-org.github.io/iptv/categories/music.m3u', category: 'category', flag: '🎵', priority: 70 },
  { id: 'kids', name: 'Kids', description: 'Kids channels worldwide', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u', category: 'category', flag: '👶', priority: 70 },
  { id: 'entertainment', name: 'Entertainment', description: 'Entertainment channels worldwide', url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u', category: 'category', flag: '🎪', priority: 70 },
  { id: 'documentary', name: 'Documentary', description: 'Documentary channels', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u', category: 'category', flag: '🔬', priority: 65 },
  { id: 'culture', name: 'Culture', description: 'Culture channels', url: 'https://iptv-org.github.io/iptv/categories/culture.m3u', category: 'category', flag: '🏛️', priority: 60 },
  { id: 'education', name: 'Education', description: 'Education channels', url: 'https://iptv-org.github.io/iptv/categories/education.m3u', category: 'category', flag: '🎓', priority: 60 },
  { id: 'religious', name: 'Religious', description: 'Religious channels', url: 'https://iptv-org.github.io/iptv/categories/religious.m3u', category: 'category', flag: '🕌', priority: 65 },
  { id: 'business', name: 'Business', description: 'Business channels', url: 'https://iptv-org.github.io/iptv/categories/business.m3u', category: 'category', flag: '💼', priority: 55 },
  { id: 'cooking', name: 'Cooking', description: 'Cooking channels', url: 'https://iptv-org.github.io/iptv/categories/cooking.m3u', category: 'category', flag: '🍳', priority: 50 },
  { id: 'lifestyle', name: 'Lifestyle', description: 'Lifestyle channels', url: 'https://iptv-org.github.io/iptv/categories/lifestyle.m3u', category: 'category', flag: '🌿', priority: 55 },
  { id: 'series', name: 'Series', description: 'Series/TV shows channels', url: 'https://iptv-org.github.io/iptv/categories/series.m3u', category: 'category', flag: '📺', priority: 60 },
  { id: 'science', name: 'Science', description: 'Science channels', url: 'https://iptv-org.github.io/iptv/categories/science.m3u', category: 'category', flag: '⚛️', priority: 55 },
  { id: 'travel', name: 'Travel', description: 'Travel channels', url: 'https://iptv-org.github.io/iptv/categories/travel.m3u', category: 'category', flag: '✈️', priority: 55 },
  { id: 'animation', name: 'Animation', description: 'Animation channels', url: 'https://iptv-org.github.io/iptv/categories/animation.m3u', category: 'category', flag: '🎨', priority: 55 },
  { id: 'comedy', name: 'Comedy', description: 'Comedy channels', url: 'https://iptv-org.github.io/iptv/categories/comedy.m3u', category: 'category', flag: '😂', priority: 50 },
  { id: 'classic', name: 'Classic', description: 'Classic channels', url: 'https://iptv-org.github.io/iptv/categories/classic.m3u', category: 'category', flag: '📽️', priority: 45 },
  { id: 'family', name: 'Family', description: 'Family channels', url: 'https://iptv-org.github.io/iptv/categories/family.m3u', category: 'category', flag: '👨‍👩‍👧', priority: 50 },
  { id: 'legislative', name: 'Legislative', description: 'Legislative channels', url: 'https://iptv-org.github.io/iptv/categories/legislative.m3u', category: 'category', flag: '⚖️', priority: 40 },
  { id: 'outdoor', name: 'Outdoor', description: 'Outdoor channels', url: 'https://iptv-org.github.io/iptv/categories/outdoor.m3u', category: 'category', flag: '🏕️', priority: 45 },
  { id: 'auto', name: 'Auto', description: 'Auto channels', url: 'https://iptv-org.github.io/iptv/categories/auto.m3u', category: 'category', flag: '🏎️', priority: 45 },
  { id: 'weather', name: 'Weather', description: 'Weather channels', url: 'https://iptv-org.github.io/iptv/categories/weather.m3u', category: 'category', flag: '🌦️', priority: 45 },
  { id: 'shop', name: 'Shop', description: 'Shopping channels', url: 'https://iptv-org.github.io/iptv/categories/shop.m3u', category: 'category', flag: '🛍️', priority: 35 },
  { id: 'public', name: 'Public', description: 'Public channels', url: 'https://iptv-org.github.io/iptv/categories/public.m3u', category: 'category', flag: '📡', priority: 45 },

  // ─── Curated sorted indexes ───────────────────────────────────────────────
  { id: 'index-category', name: 'Sorted by Category', description: 'All channels grouped by category', url: 'https://iptv-org.github.io/iptv/index.category.m3u', category: 'curated', flag: '🗂️', priority: 40 },
  { id: 'index-country', name: 'Sorted by Country', description: 'All channels grouped by country', url: 'https://iptv-org.github.io/iptv/index.country.m3u', category: 'curated', flag: '🗺️', priority: 40 },
  { id: 'index-language', name: 'Sorted by Language', description: 'All channels grouped by language', url: 'https://iptv-org.github.io/iptv/index.language.m3u', category: 'curated', flag: '🗣️', priority: 40 },
  { id: 'index-region', name: 'Sorted by Region', description: 'All channels grouped by region', url: 'https://iptv-org.github.io/iptv/index.region.m3u', category: 'curated', flag: '🌐', priority: 40 },

  // ─── Other popular languages ──────────────────────────────────────────────
  { id: 'eng', name: 'English (All)', description: 'All English-language channels', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u', category: 'featured', flag: '🇬🇧', priority: 70 },
  { id: 'fra', name: 'French (All)', description: 'All French-language channels', url: 'https://iptv-org.github.io/iptv/languages/fra.m3u', category: 'featured', flag: '🇫🇷', priority: 65 },
  { id: 'deu', name: 'German (All)', description: 'All German-language channels', url: 'https://iptv-org.github.io/iptv/languages/deu.m3u', category: 'featured', flag: '🇩🇪', priority: 65 },
  { id: 'rus', name: 'Russian (All)', description: 'All Russian-language channels', url: 'https://iptv-org.github.io/iptv/languages/rus.m3u', category: 'featured', flag: '🇷🇺', priority: 65 },
  { id: 'hin', name: 'Hindi (All)', description: 'All Hindi-language channels', url: 'https://iptv-org.github.io/iptv/languages/hin.m3u', category: 'featured', flag: '🇮🇳', priority: 65 },
  { id: 'urd', name: 'Urdu (All)', description: 'All Urdu-language channels', url: 'https://iptv-org.github.io/iptv/languages/urd.m3u', category: 'featured', flag: '🇵🇰', priority: 60 },
  { id: 'zho', name: 'Chinese (All)', description: 'All Chinese-language channels', url: 'https://iptv-org.github.io/iptv/languages/zho.m3u', category: 'featured', flag: '🇨🇳', priority: 60 },
  { id: 'tur', name: 'Turkish (All)', description: 'All Turkish-language channels', url: 'https://iptv-org.github.io/iptv/languages/tur.m3u', category: 'featured', flag: '🇹🇷', priority: 65 },
]

export function getPlaylistById(id: string): PlaylistSource | undefined {
  return PLAYLIST_SOURCES.find((p) => p.id === id)
}

export const PLAYLIST_CATEGORIES: { id: PlaylistCategory; label: string; flag: string }[] = [
  { id: 'featured', label: 'Featured', flag: '⭐' },
  { id: 'arabic', label: 'Arabic', flag: '🇸🇦' },
  { id: 'middle-east', label: 'Middle East', flag: '🕌' },
  { id: 'europe', label: 'Europe', flag: '🇪🇺' },
  { id: 'americas', label: 'Americas', flag: '🌎' },
  { id: 'asia', label: 'Asia', flag: '🌏' },
  { id: 'africa', label: 'Africa', flag: '🌍' },
  { id: 'category', label: 'Categories', flag: '🎬' },
  { id: 'curated', label: 'Indexes', flag: '📚' },
]

export function getSourcesByCategory(cat: PlaylistCategory): PlaylistSource[] {
  return PLAYLIST_SOURCES.filter((s) => s.category === cat).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}
