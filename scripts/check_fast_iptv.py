#!/usr/bin/env python3
"""
Stream checker for FAST IPTV playlists.
Tests each channel and saves filtered M3U files with only working channels.
"""

import sys
import os
import re
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# Reuse the checker logic from check_all_streams.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_all_streams import check_url, parse_m3u, fetch_playlist, HEADERS, TIMEOUT, MAX_WORKERS

FAST_IPTV_PLAYLISTS = [
    # World Cup 2026
    ('fast-iptv', 'world-cup', 'f-fifa', 'FIFA BDIX',
     'https://raw.githubusercontent.com/ahan443/FAST-IPTV/main/FIFA.m3u',
     'fast-iptv-world-cup-f-fifa.m3u'),
    ('fast-iptv', 'world-cup', 'f-combined', 'Combined Sports',
     'https://raw.githubusercontent.com/ahan443/FAST-IPTV/main/combined_playlist.m3u',
     'fast-iptv-world-cup-f-combined.m3u'),
    # Countries
    ('fast-iptv', 'countries', 'f-indian', 'Indian',
     'https://raw.githubusercontent.com/ahan443/FAST-IPTV/main/Indian.m3u',
     'fast-iptv-countries-f-indian.m3u'),
    ('fast-iptv', 'countries', 'f-world-4k', 'Bangladesh 4K',
     'https://raw.githubusercontent.com/ahan443/FAST-IPTV/main/m3u_world_4k.m3u8',
     'fast-iptv-countries-f-world-4k.m3u'),
    ('fast-iptv', 'countries', 'f-play', 'Indonesia Play',
     'https://raw.githubusercontent.com/ahan443/FAST-IPTV/main/Play.m3u',
     'fast-iptv-countries-f-play.m3u'),
    # Content
    ('fast-iptv', 'content', 'f-movies', 'Movies',
     'https://raw.githubusercontent.com/ahan443/FAST-IPTV/main/movies.m3u8',
     'fast-iptv-content-f-movies.m3u'),
    ('fast-iptv', 'content', 'f-direct', 'Direct M3U',
     'https://raw.githubusercontent.com/ahan443/FAST-IPTV/main/direct_M3u.m3u',
     'fast-iptv-content-f-direct.m3u'),
    ('fast-iptv', 'content', 'f-channels', 'Channels',
     'https://raw.githubusercontent.com/ahan443/FAST-IPTV/main/channels(1).m3u',
     'fast-iptv-content-f-channels.m3u'),
]


def check_playlist(provider, category, playlist, name, url, output_file, limit=None):
    print(f'\n{"=" * 80}')
    print(f'Checking: {name}')
    print(f'URL: {url}')
    print(f'{"=" * 80}')

    try:
        content = fetch_playlist(url)
    except Exception as e:
        print(f'  ❌ FAILED to fetch: {e}')
        return {'name': name, 'total': 0, 'working': 0, 'dead': 0, 'error': str(e)}

    channels = parse_m3u(content)
    total = len(channels)
    print(f'  Total channels: {total}')

    if limit and total > limit:
        channels_to_test = channels[:limit]
        print(f'  ⚠️  Limiting to first {limit}')
    else:
        channels_to_test = channels

    print(f'  Testing {len(channels_to_test)} channels...')

    results = {}
    def check_one(idx_ch):
        idx, ch = idx_ch
        works, reason = check_url(ch['url'])
        return idx, works, reason

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(check_one, (i, ch)): i for i, ch in enumerate(channels_to_test)}
        done = 0
        for future in as_completed(futures):
            idx, works, reason = future.result()
            results[idx] = (works, reason)
            done += 1
            if done % 25 == 0:
                print(f'    Progress: {done}/{len(channels_to_test)}')

    working = []
    dead = []
    for idx, ch in enumerate(channels_to_test):
        if idx in results:
            works, reason = results[idx]
            if works:
                working.append(ch)
            else:
                dead.append((ch, reason))

    print(f'\n  ✅ Working: {len(working)} / {len(channels_to_test)}')
    print(f'  ❌ Dead: {len(dead)} / {len(channels_to_test)}')

    if working:
        print(f'\n  Sample working:')
        for ch in working[:5]:
            print(f'    ✅ {ch["name"][:60]}')
        if len(working) > 5:
            print(f'    ... and {len(working) - 5} more')

    if dead:
        print(f'\n  Sample dead:')
        for ch, reason in dead[:3]:
            print(f'    ❌ {ch["name"][:60]} | {reason}')

    # Save filtered M3U
    if working:
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'filtered')
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('#EXTM3U\n')
            seen = set()
            for ch in working:
                if ch['url'] not in seen:
                    f.write(f'{ch["extinf"]}\n')
                    f.write(f'{ch["url"]}\n')
                    seen.add(ch['url'])
        print(f'\n  💾 Saved: public/filtered/{output_file} ({len(working)} channels)')
    else:
        print(f'\n  ⚠️  No working channels')

    return {
        'name': name,
        'provider': provider,
        'category': category,
        'playlist': playlist,
        'url': url,
        'output_file': output_file,
        'total': total,
        'tested': len(channels_to_test),
        'working': len(working),
        'dead': len(dead),
    }


def main():
    print('🔍 FAST IPTV Stream Checker')
    print(f'   Timeout: {TIMEOUT}s | Workers: {MAX_WORKERS}')

    all_results = []
    start = time.time()

    for provider, category, playlist, name, url, output_file in FAST_IPTV_PLAYLISTS:
        result = check_playlist(provider, category, playlist, name, url, output_file)
        all_results.append(result)

    elapsed = time.time() - start

    print(f'\n{"=" * 80}')
    print(f'FINAL SUMMARY (took {elapsed:.0f}s)')
    print(f'{"=" * 80}')
    print(f'{"Playlist":<25} {"Total":<8} {"Tested":<8} {"Working":<8} {"Dead":<8}')
    print('-' * 80)
    total_working = 0
    total_tested = 0
    for r in all_results:
        if 'error' in r:
            print(f'{r["name"]:<25} {"ERR":<8}')
        else:
            print(f'{r["name"]:<25} {r["total"]:<8} {r["tested"]:<8} {r["working"]:<8} {r["dead"]:<8}')
            total_working += r['working']
            total_tested += r['tested']
    print('-' * 80)
    print(f'{"TOTAL":<25} {"":<8} {total_tested:<8} {total_working:<8} {total_tested - total_working:<8}')


if __name__ == '__main__':
    main()
