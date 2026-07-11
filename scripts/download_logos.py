#!/usr/bin/env python3
"""
Download provider logos from Wikipedia using the API to find correct file URLs.
"""

import os
import requests
import json

# Search terms for each provider — Wikipedia will find the actual file
LOGO_SEARCHES = {
    'pluto-tv': 'Pluto TV logo 2024',
    'samsung-tv': 'Samsung TV Plus',
    'lg-channels': 'LG Electronics logo',
    'tubi': 'Tubi 2024',
    'roku': 'Roku 2023',
    'vizio': 'Vizio logo',
    'xumo': 'Xumo 2023',
    'rakuten': 'Rakuten 2022',
    'other-fast': 'TCL logo',
    'bein': 'BeIN Sports 2023',
}

HEADERS = {
    'User-Agent': 'FreeStreamTV/1.0 (https://freestream.tv)',
    'Accept': 'image/*,*/*',
}

def find_wikipedia_file(search_term):
    """Search Wikipedia for a file and return its direct URL."""
    # Search for files
    api_url = f'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={requests.utils.quote(search_term)}&srnamespace=6&format=json'
    r = requests.get(api_url, headers=HEADERS, timeout=10)
    if r.status_code != 200:
        return None
    data = r.json()
    results = data.get('query', {}).get('search', [])
    if not results:
        return None
    # Get the first result's title (e.g., "File:Pluto TV logo 2024.svg")
    title = results[0]['title']
    # Get the actual URL
    api_url2 = f'https://commons.wikimedia.org/w/api.php?action=query&titles={requests.utils.quote(title)}&prop=imageinfo&iiprop=url&format=json'
    r2 = requests.get(api_url2, headers=HEADERS, timeout=10)
    if r2.status_code != 200:
        return None
    data2 = r2.json()
    pages = data2.get('query', {}).get('pages', {})
    for p in pages.values():
        ii = p.get('imageinfo', [{}])
        if ii:
            return ii[0].get('url')
    return None


def main():
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'logos')
    os.makedirs(output_dir, exist_ok=True)

    results = {}

    # Special case: IPTV-org uses GitHub avatar
    try:
        r = requests.get('https://avatars.githubusercontent.com/u/52117680?s=200&v=4', headers=HEADERS, timeout=15)
        if r.status_code == 200:
            with open(os.path.join(output_dir, 'iptv-org.png'), 'wb') as f:
                f.write(r.content)
            results['iptv-org'] = '/logos/iptv-org.png'
            print('✅ iptv-org.png')
    except Exception as e:
        print(f'❌ iptv-org: {e}')

    # Download each logo via Wikipedia API
    for name, search in LOGO_SEARCHES.items():
        print(f'Downloading {name} (search: "{search}")...', end=' ')
        try:
            file_url = find_wikipedia_file(search)
            if not file_url:
                print('❌ file not found on Wikipedia')
                continue

            r = requests.get(file_url, headers=HEADERS, timeout=15)
            if r.status_code == 200 and len(r.content) > 500:
                ext = 'svg' if file_url.endswith('.svg') else 'png'
                output_file = f'{name}.{ext}'
                with open(os.path.join(output_dir, output_file), 'wb') as f:
                    f.write(r.content)
                print(f'✅ {output_file} ({len(r.content)} bytes)')
                results[name] = f'/logos/{output_file}'
            else:
                print(f'❌ HTTP {r.status_code}')
        except Exception as e:
            print(f'❌ {e}')

    # Save mapping
    mapping_path = os.path.join(output_dir, 'mapping.json')
    with open(mapping_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f'\n✅ {len(results)} logos downloaded')
    print(f'Mapping: {mapping_path}')
    print('\nUpdate playlists.ts with these paths:')
    for name, path in results.items():
        print(f"  logo: '{path}',  // {name}")


if __name__ == '__main__':
    main()
