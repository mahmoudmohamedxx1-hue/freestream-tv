// ISO country code → emoji flag mapping
// Used to display country flags next to channel names.

export const COUNTRY_FLAGS: Record<string, string> = {
  // Middle East / Arabic
  sa: '🇸🇦', eg: '🇪🇬', ae: '🇦🇪', qa: '🇶🇦', kw: '🇰🇼', bh: '🇧🇭', om: '🇴🇲', ye: '🇾🇪',
  jo: '🇯🇴', lb: '🇱🇧', sy: '🇸🇾', iq: '🇮🇶', ps: '🇵🇸', sd: '🇸🇩', ly: '🇱🇾',
  tn: '🇹🇳', dz: '🇩🇿', ma: '🇲🇦', mr: '🇲🇷', so: '🇸🇴', dj: '🇩🇯', km: '🇰🇲',
  ir: '🇮🇷', tr: '🇹🇷', il: '🇮🇱',
  // Europe
  uk: '🇬🇧', gb: '🇬🇧', fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', it: '🇮🇹', pt: '🇵🇹',
  nl: '🇳🇱', be: '🇧🇪', ch: '🇨🇭', at: '🇦🇹', se: '🇸🇪', no: '🇳🇴', dk: '🇩🇰',
  fi: '🇫🇮', pl: '🇵🇱', ru: '🇷🇺', ua: '🇺🇦', gr: '🇬🇷', ro: '🇷🇴', cz: '🇨🇿',
  hu: '🇭🇺', bg: '🇧🇬', rs: '🇷🇸', hr: '🇭🇷', ie: '🇮🇪', is: '🇮🇸', sk: '🇸🇰',
  si: '🇸🇮', lt: '🇱🇹', lv: '🇱🇻', ee: '🇪🇪', md: '🇲🇩', by: '🇧🇾', ge: '🇬🇪',
  am: '🇦🇲', az: '🇦🇿',
  // Americas
  us: '🇺🇸', ca: '🇨🇦', mx: '🇲🇽', br: '🇧🇷', ar: '🇦🇷', co: '🇨🇴', cl: '🇨🇱',
  pe: '🇵🇪', ve: '🇻🇪', ec: '🇪🇨', bo: '🇧🇴', py: '🇵🇾', uy: '🇺🇾', gy: '🇬🇾',
  sr: '🇸🇷', cu: '🇨🇺', do: '🇩🇴', gt: '🇬🇹', hn: '🇭🇳', sv: '🇸🇻', ni: '🇳🇮',
  cr: '🇨🇷', pa: '🇵🇦', pr: '🇵🇷', jm: '🇯🇲', ht: '🇭🇹', bs: '🇧🇸', tt: '🇹🇹',
  // Asia
  in: '🇮🇳', pk: '🇵🇰', bd: '🇧🇩', cn: '🇨🇳', hk: '🇭🇰', tw: '🇹🇼', jp: '🇯🇵',
  kr: '🇰🇷', th: '🇹🇭', vn: '🇻🇳', id: '🇮🇩', my: '🇲🇾', ph: '🇵🇭', sg: '🇸🇬',
  lk: '🇱🇰', af: '🇦🇫', np: '🇳🇵', mm: '🇲🇲', kh: '🇰🇭', la: '🇱🇦', mn: '🇲🇳',
  kz: '🇰🇿', uz: '🇺🇿', tm: '🇹🇲', kg: '🇰🇬', tj: '🇹🇯',
  // Africa (non-Arab)
  ng: '🇳🇬', za: '🇿🇦', ke: '🇰🇪', gh: '🇬🇭', et: '🇪🇹', sn: '🇸🇳', tz: '🇹🇿',
  ug: '🇺🇬', cm: '🇨🇲', ci: '🇨🇮', cg: '🇨🇬', cd: '🇨🇩', zm: '🇿🇲', zw: '🇿🇼',
  rw: '🇷🇼', bi: '🇧🇮', mw: '🇲🇼', mz: '🇲🇿', ao: '🇦🇴', bw: '🇧🇼', na: '🇳🇦',
  gm: '🇬🇲', ml: '🇲🇱', bf: '🇧🇫', ne: '🇳🇪', tg: '🇹🇬', bj: '🇧🇯', sl: '🇸🇱',
  lr: '🇱🇷', mg: '🇲🇬', mu: '🇲🇺', sc: '🇸🇨',
  // Oceania
  au: '🇦🇺', nz: '🇳🇿', pg: '🇵🇬', fj: '🇫🇯',
}

export function flagForCountry(code?: string): string | undefined {
  if (!code) return undefined
  return COUNTRY_FLAGS[code.toLowerCase()]
}

/** Categorize a channel into a display country group based on country code, group name, or name hints */
export function deriveCountryGroup(channel: {
  countryCode?: string
  country?: string
  group?: string
  name: string
  displayName?: string
}): string {
  // 1. Try ISO code from tvg-id
  if (channel.countryCode && flagForCountry(channel.countryCode)) {
    return channel.countryCode.toUpperCase()
  }
  // 2. Try tvg-country field
  if (channel.country) {
    const codes = channel.country.split(/[;,]/).map(s => s.trim().toLowerCase())
    for (const c of codes) {
      if (flagForCountry(c)) return c.toUpperCase()
    }
  }
  // 3. Try to detect from group name
  const g = (channel.group || '').toLowerCase()
  const name = (channel.displayName || channel.name || '').toLowerCase()
  const arabicCodes = ['eg', 'sa', 'ae', 'qa', 'kw', 'bh', 'om', 'ye', 'jo', 'lb', 'sy', 'iq', 'ps', 'sd', 'ly', 'tn', 'dz', 'ma', 'mr', 'so', 'dj', 'km']
  for (const c of arabicCodes) {
    if (g.includes(c) || name.includes(c)) return c.toUpperCase()
  }
  // 4. Try common channel-name hints
  if (/arabic|alarab|al jazeera|aljazeera|mbc|rotana|al nahar|al hayat|al araby/i.test(name)) return 'AR'
  if (/bein|beIN/i.test(name)) return 'AR'
  // 5. Default
  return 'Intl'
}
