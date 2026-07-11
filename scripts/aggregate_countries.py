#!/usr/bin/env python3
"""
Countries aggregator (optimized) — builds per-country playlists from ALL providers
WITHOUT testing each URL (sources are already filtered/verified).

Fetches channels from all sources, detects the country for each channel,
and saves per-country M3U files. Much faster than the testing version.
"""

import os
import re
import sys
import json
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curate_best_100 import parse_m3u, fetch_source

COUNTRIES = {
    'US': ('United States', '🇺🇸'), 'GB': ('United Kingdom', '🇬🇧'), 'CA': ('Canada', '🇨🇦'),
    'AU': ('Australia', '🇦🇺'), 'FR': ('France', '🇫🇷'), 'DE': ('Germany', '🇩🇪'),
    'ES': ('Spain', '🇪🇸'), 'IT': ('Italy', '🇮🇹'), 'BR': ('Brazil', '🇧🇷'),
    'MX': ('Mexico', '🇲🇽'), 'AR': ('Argentina', '🇦🇷'), 'CL': ('Chile', '🇨🇱'),
    'CO': ('Colombia', '🇨🇴'), 'PE': ('Peru', '🇵🇪'), 'NL': ('Netherlands', '🇳🇱'),
    'SE': ('Sweden', '🇸🇪'), 'NO': ('Norway', '🇳🇴'), 'DK': ('Denmark', '🇩🇰'),
    'FI': ('Finland', '🇫🇮'), 'PL': ('Poland', '🇵🇱'), 'RU': ('Russia', '🇷🇺'),
    'TR': ('Turkey', '🇹🇷'), 'IR': ('Iran', '🇮🇷'), 'IL': ('Israel', '🇮🇱'),
    'EG': ('Egypt', '🇪🇬'), 'SA': ('Saudi Arabia', '🇸🇦'), 'AE': ('UAE', '🇦🇪'),
    'QA': ('Qatar', '🇶🇦'), 'KW': ('Kuwait', '🇰🇼'), 'BH': ('Bahrain', '🇧🇭'),
    'OM': ('Oman', '🇴🇲'), 'YE': ('Yemen', '🇾🇪'), 'JO': ('Jordan', '🇯🇴'),
    'LB': ('Lebanon', '🇱🇧'), 'SY': ('Syria', '🇸🇾'), 'IQ': ('Iraq', '🇮🇶'),
    'PS': ('Palestine', '🇵🇸'), 'TN': ('Tunisia', '🇹🇳'), 'DZ': ('Algeria', '🇩🇿'),
    'MA': ('Morocco', '🇲🇦'), 'LY': ('Libya', '🇱🇾'), 'SD': ('Sudan', '🇸🇩'),
    'IN': ('India', '🇮🇳'), 'PK': ('Pakistan', '🇵🇰'), 'BD': ('Bangladesh', '🇧🇩'),
    'CN': ('China', '🇨🇳'), 'JP': ('Japan', '🇯🇵'), 'KR': ('South Korea', '🇰🇷'),
    'TH': ('Thailand', '🇹🇭'), 'VN': ('Vietnam', '🇻🇳'), 'ID': ('Indonesia', '🇮🇩'),
    'MY': ('Malaysia', '🇲🇾'), 'PH': ('Philippines', '🇵🇭'), 'SG': ('Singapore', '🇸🇬'),
    'ZA': ('South Africa', '🇿🇦'), 'NG': ('Nigeria', '🇳🇬'), 'KE': ('Kenya', '🇰🇪'),
    'GH': ('Ghana', '🇬🇭'), 'ET': ('Ethiopia', '🇪🇹'), 'SN': ('Senegal', '🇸🇳'),
    'GR': ('Greece', '🇬🇷'), 'PT': ('Portugal', '🇵🇹'), 'CH': ('Switzerland', '🇨🇭'),
    'AT': ('Austria', '🇦🇹'), 'BE': ('Belgium', '🇧🇪'), 'IE': ('Ireland', '🇮🇪'),
    'CZ': ('Czech Republic', '🇨🇿'), 'RO': ('Romania', '🇷🇴'), 'HU': ('Hungary', '🇭🇺'),
    'UA': ('Ukraine', '🇺🇦'), 'HK': ('Hong Kong', '🇭🇰'), 'TW': ('Taiwan', '🇹🇼'),
    'NZ': ('New Zealand', '🇳🇿'), 'LK': ('Sri Lanka', '🇱🇰'),
}

COUNTRY_NAME_KEYWORDS = {
    'US': ['usa', 'america', 'united states'],
    'GB': ['uk ', 'britain', 'british', 'england'],
    'FR': ['french', 'france'],
    'DE': ['german', 'germany', 'deutsch'],
    'ES': ['spanish', 'spain', 'español'],
    'IT': ['italian', 'italia'],
    'TR': ['turkish', 'turkey', 'türk'],
    'IR': ['persian', 'iran'],
    'AE': ['emirates', 'dubai'],
    'SA': ['saudi', 'arabia'],
    'EG': ['egypt', 'masr', 'masry'],
    'IN': ['india', 'indian', 'hindi', 'bollywood'],
    'PK': ['pakistan', 'urdu'],
    'CN': ['china', 'chinese', 'cctv'],
    'JP': ['japan', 'japanese', 'nhk'],
    'KR': ['korea', 'korean', 'arirang', 'kbs'],
    'BR': ['brazil', 'brazilian'],
    'RU': ['russia', 'russian'],
    'AU': ['australia', 'australian'],
    'CA': ['canada', 'canadian'],
}


def detect_country(channel):
    tvg_id = channel.get('tvgId') or ''
    if tvg_id:
        m = re.search(r'\.([a-z]{2})$', tvg_id, re.IGNORECASE)
        if m:
            code = m.group(1).upper()
            if code in COUNTRIES:
                return code
    country_field = (channel.get('country') or '').upper()
    if country_field in COUNTRIES:
        return country_field
    text = f'{channel.get("name", "")} {channel.get("group", "")}'.lower()
    for code, keywords in COUNTRY_NAME_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return code
    return None


def main():
    print('🌍 FreeStream TV — Countries Aggregator (fast mode, no URL testing)')
    print()

    SOURCES_TO_USE = [
        ('LG US', 'https://www.apsattv.com/uslg.m3u'),
        ('LG UK', 'https://www.apsattv.com/gblg.m3u'),
        ('LG Germany', 'https://www.apsattv.com/delg.m3u'),
        ('LG France', 'https://www.apsattv.com/frlg.m3u'),
        ('LG Spain', 'https://www.apsattv.com/eslg.m3u'),
        ('LG Italy', 'https://www.apsattv.com/itlg.m3u'),
        ('LG Brazil', 'https://www.apsattv.com/brlg.m3u'),
        ('LG Mexico', 'https://www.apsattv.com/mxlg.m3u'),
        ('LG India', 'https://www.apsattv.com/inlg.m3u'),
        ('LG Japan', 'https://www.apsattv.com/jplg.m3u'),
        ('LG Korea', 'https://www.apsattv.com/krlg.m3u'),
        ('LG UAE', 'https://www.apsattv.com/aelg.m3u'),
        ('Samsung US', '/filtered/iptv-streams-samsung-tv-us-samsung.m3u'),
        ('Samsung UK', '/filtered/iptv-streams-samsung-tv-uk-samsung.m3u'),
        ('World Verified', '/filtered/world-iptv-verified-all.m3u'),
        ('Free-TV', '/filtered/free-tv-all.m3u'),
        ('FAST IPTV Play', '/filtered/fast-iptv-countries-f-play.m3u'),
        ('FAST IPTV Indian', '/filtered/fast-iptv-countries-f-indian.m3u'),
        ('IPTV4ON', '/filtered/iptv4on-all.m3u'),
        ('Tubi', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u'),
        ('Roku', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u'),
    ]

    country_channels = {code: [] for code in COUNTRIES}
    seen_urls = set()

    for source_name, source_url in SOURCES_TO_USE:
        print(f'📥 {source_name}')
        try:
            content = fetch_source(source_url)
            channels = parse_m3u(content)
            classified = 0
            for ch in channels:
                if ch['url'] in seen_urls:
                    continue
                tvg_match = re.search(r'tvg-id="([^"]+)"', ch.get('extinf', ''))
                ch['tvgId'] = tvg_match.group(1) if tvg_match else ''
                country_match = re.search(r'tvg-country="([^"]+)"', ch.get('extinf', ''))
                ch['country'] = country_match.group(1) if country_match else ''

                code = detect_country(ch)
                if code:
                    seen_urls.add(ch['url'])
                    country_channels[code].append({**ch, 'source': source_name})
                    classified += 1
            print(f'   {len(channels)} parsed, {classified} classified')
        except Exception as e:
            print(f'   ❌ {e}')

    # Save per-country M3U files (cap at 100 per country)
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'countries')
    os.makedirs(output_dir, exist_ok=True)

    summary = []
    for code in sorted(COUNTRIES.keys(), key=lambda c: -len(country_channels[c])):
        channels = country_channels[code]
        if not channels:
            continue

        name, flag = COUNTRIES[code]
        capped = channels[:100]

        output_file = f'{code.lower()}.m3u'
        output_path = os.path.join(output_dir, output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f'#EXTM3U\n# {name} — {len(capped)} channels (aggregated by FreeStream TV)\n')
            for ch in capped:
                f.write(f'{ch["extinf"]}\n')
                f.write(f'{ch["url"]}\n')

        print(f'💾 {flag} {code} {name}: {len(capped)} channels')
        summary.append({'code': code, 'name': name, 'flag': flag, 'channels': len(capped)})

    # Save summary
    summary_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'countries-summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f'\n{"=" * 60}')
    print(f'🌍 COUNTRIES AGGREGATION COMPLETE')
    print(f'{"=" * 60}')
    total = sum(s['channels'] for s in summary)
    print(f'{len(summary)} countries, {total} total channels')
    print(f'Summary: {summary_path}')


if __name__ == '__main__':
    main()
