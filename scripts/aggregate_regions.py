#!/usr/bin/env python3
"""
World Regions aggregator — groups country playlists into world regions.

Reads the per-country M3U files from public/countries/ and combines them
into regional playlists:
- Europe
- Middle East & North Africa
- Sub-Saharan Africa
- Asia (East & Southeast)
- South Asia
- Americas (North)
- Americas (South & Central)
- Oceania

Output: public/regions/<region>.m3u
"""

import os
import re
import sys
import json

# ─── Region → countries mapping ─────────────────────────────────────────────
REGIONS = {
    'europe': {
        'name': 'Europe',
        'flag': '🇪🇺',
        'countries': ['GB', 'FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE', 'CH', 'AT',
                      'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR', 'IE', 'HU', 'RO',
                      'BG', 'RS', 'HR', 'UA', 'RU'],
    },
    'middle-east-north-africa': {
        'name': 'Middle East & North Africa',
        'flag': '🕌',
        'countries': ['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'LB', 'SY',
                      'IQ', 'PS', 'EG', 'LY', 'TN', 'DZ', 'MA', 'MR', 'IR', 'IL'],
    },
    'sub-saharan-africa': {
        'name': 'Sub-Saharan Africa',
        'flag': '🌍',
        'countries': ['NG', 'ZA', 'KE', 'GH', 'ET', 'SN', 'SO', 'SD'],
    },
    'east-southeast-asia': {
        'name': 'East & Southeast Asia',
        'flag': '🌏',
        'countries': ['CN', 'JP', 'KR', 'TW', 'HK', 'TH', 'VN', 'ID', 'MY',
                      'PH', 'SG', 'KH'],
    },
    'south-asia': {
        'name': 'South Asia',
        'flag': '🇮🇳',
        'countries': ['IN', 'PK', 'BD', 'LK'],
    },
    'north-america': {
        'name': 'North America',
        'flag': '🌎',
        'countries': ['US', 'CA', 'MX'],
    },
    'south-central-america': {
        'name': 'South & Central America',
        'flag': '🌴',
        'countries': ['BR', 'AR', 'CL', 'CO', 'PE', 'EC', 'VE'],
    },
    'oceania': {
        'name': 'Oceania',
        'flag': '🇦🇺',
        'countries': ['AU', 'NZ'],
    },
}


def main():
    print('🗺️  FreeStream TV — World Regions Aggregator')
    print()

    countries_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'countries')
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'regions')
    os.makedirs(output_dir, exist_ok=True)

    summary = []

    for region_id, region in REGIONS.items():
        print(f'🗺️  {region["flag"]} {region["name"]}')
        combined_channels = []
        seen_urls = set()
        countries_included = 0

        for country_code in region['countries']:
            country_file = os.path.join(countries_dir, f'{country_code.lower()}.m3u')
            if not os.path.exists(country_file):
                continue
            countries_included += 1
            try:
                with open(country_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                # Parse channels, skip header
                lines = content.split('\n')
                pending_extinf = ''
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith('#EXTINF'):
                        pending_extinf = line
                    elif line.startswith('#'):
                        continue
                    else:
                        if line not in seen_urls:
                            seen_urls.add(line)
                            combined_channels.append((pending_extinf, line))
                            pending_extinf = ''
            except Exception as e:
                print(f'   ❌ {country_code}: {e}')

        # Save region file
        output_file = f'{region_id}.m3u'
        output_path = os.path.join(output_dir, output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f'#EXTM3U\n# {region["name"]} — {len(combined_channels)} channels from {countries_included} countries\n')
            for extinf, url in combined_channels:
                f.write(f'{extinf}\n')
                f.write(f'{url}\n')

        print(f'   ✅ {countries_included} countries, {len(combined_channels)} channels → {output_file}')
        summary.append({
            'id': region_id,
            'name': region['name'],
            'flag': region['flag'],
            'countries': countries_included,
            'channels': len(combined_channels),
        })

    # Final summary
    print(f'\n{"=" * 60}')
    print('🗺️  WORLD REGIONS AGGREGATION COMPLETE')
    print(f'{"=" * 60}')
    print(f'{"Region":<35} {"Countries":<12} {"Channels":<10}')
    print('-' * 60)
    total = 0
    for s in summary:
        print(f'{s["flag"]} {s["name"]:<32} {s["countries"]:<12} {s["channels"]:<10}')
        total += s['channels']
    print('-' * 60)
    print(f'{"TOTAL":<35} {"":<12} {total:<10}')

    # Save summary
    summary_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'regions-summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f'\nSummary: {summary_path}')


if __name__ == '__main__':
    main()
