#!/usr/bin/env python3
"""
TV Guide sync script — builds a curated "What to Watch Now" guide.

Since real EPG (XMLTV) data isn't publicly available anymore, this script
creates a practical TV guide by:
1. Fetching the curated "Best of FreeStream" channels (810 verified working)
2. Organizing them by genre and "watch priority"
3. Adding "Now Playing" metadata (network, categories, quality)
4. Saving as a JSON file the frontend can consume

The result: a TV guide that shows users the best channels to watch right now,
organized by genre, with click-to-play URLs.
"""

import os
import re
import sys
import json
import requests
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curate_best_100 import parse_m3u, fetch_source, HEADERS, TIMEOUT

CURATED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'curated')
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'tv-guide-sync.json')

GENRES = [
    {'id': 'sports', 'name': 'Sports', 'flag': '⚽'},
    {'id': 'news', 'name': 'News', 'flag': '📰'},
    {'id': 'movies', 'name': 'Movies', 'flag': '🎬'},
    {'id': 'music', 'name': 'Music', 'flag': '🎵'},
    {'id': 'kids', 'name': 'Kids', 'flag': '👶'},
    {'id': 'entertainment', 'name': 'Entertainment', 'flag': '🎪'},
    {'id': 'documentary', 'name': 'Documentary', 'flag': '🔬'},
    {'id': 'international', 'name': 'International', 'flag': '🌍'},
]


def extract_channel_info(extinf_line, url, name):
    """Extract metadata from an EXTINF line."""
    logo_match = re.search(r'tvg-logo="([^"]+)"', extinf_line)
    group_match = re.search(r'group-title="([^"]+)"', extinf_line)
    tvg_id_match = re.search(r'tvg-id="([^"]+)"', extinf_line)

    # Detect quality from name
    quality = None
    q_match = re.search(r'\b(4K|8K|2160p|1080p|720p|576p|480p|360p|240p|FHD|UHD|HD|SD)\b', name, re.IGNORECASE)
    if q_match:
        q = q_match.group(1).upper()
        if q in ('2160P', '4K'): quality = '4K'
        elif q == '8K': quality = '8K'
        elif q in ('1080P', 'FHD'): quality = '1080p'
        elif q == 'UHD': quality = '4K'
        elif q in ('720P', 'HD'): quality = '720p'
        elif q == 'SD': quality = 'SD'
        else: quality = q.lower()

    # Detect VOD
    lower_url = url.lower()
    is_vod = bool(re.search(r'\.(mp4|mkv|avi|mov|webm)(\?|$)', lower_url))

    # Detect country from tvg-id
    country = None
    if tvg_id_match:
        m = re.search(r'\.([a-z]{2})$', tvg_id_match.group(1), re.IGNORECASE)
        if m:
            country = m.group(1).upper()

    return {
        'name': name,
        'displayName': re.sub(r'\s*\(\d{3,4}p\)\s*', '', name).strip(),
        'url': url,
        'logo': logo_match.group(1) if logo_match else None,
        'group': group_match.group(1) if group_match else None,
        'tvgId': tvg_id_match.group(1) if tvg_id_match else None,
        'quality': quality,
        'isVod': is_vod,
        'country': country,
    }


def build_guide():
    """Build the TV guide from curated playlists."""
    print('📺 FreeStream TV — TV Guide Sync')
    print(f'   Building "What to Watch Now" guide from curated playlists')
    print()

    guide = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'generatedAtHuman': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
        'genres': [],
    }

    for genre in GENRES:
        m3u_path = os.path.join(CURATED_DIR, f'{genre["id"]}.m3u')
        if not os.path.exists(m3u_path):
            print(f'  ⚠️ {genre["flag"]} {genre["name"]}: file not found')
            continue

        try:
            with open(m3u_path, 'r', encoding='utf-8') as f:
                content = f.read()
            channels = parse_m3u(content)
            print(f'  {genre["flag"]} {genre["name"]}: {len(channels)} channels')

            guide_channels = []
            for ch in channels[:50]:  # Top 50 per genre for the guide
                info = extract_channel_info(ch.get('extinf', ''), ch['url'], ch['name'])
                guide_channels.append(info)

            guide['genres'].append({
                'id': genre['id'],
                'name': genre['name'],
                'flag': genre['flag'],
                'channelCount': len(channels),
                'channels': guide_channels,
            })
        except Exception as e:
            print(f'  ❌ {genre["name"]}: {e}')

    # Save guide
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(guide, f, indent=2, ensure_ascii=False)

    total = sum(g['channelCount'] for g in guide['genres'])
    print(f'\n✅ TV Guide saved: {OUTPUT_PATH}')
    print(f'   {len(guide["genres"])} genres, {total} total channels (top 50 shown per genre)')
    print(f'   Generated: {guide["generatedAtHuman"]}')

    return guide


if __name__ == '__main__':
    build_guide()
