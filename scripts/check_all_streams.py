#!/usr/bin/env python3
"""
Comprehensive stream checker — tests ALL channels across ALL playlists in the app.

For each playlist:
1. Fetches the M3U file
2. Parses all channels
3. Tests each channel URL (HLS manifest + variant + .ts segment, or direct HTTP 200)
4. Generates a filtered M3U file containing only the working channels
5. Saves it to public/filtered/<provider>-<category>-<playlist>.m3u

The filtered files are then used by the app instead of the raw source URLs,
so users only see channels that actually work.

Usage:
  python3 scripts/check_all_streams.py                    # check everything
  python3 scripts/check_all_streams.py --provider iptv4on # check one provider
  python3 scripts/check_all_streams.py --limit 50         # test only first 50 channels per playlist
"""

import sys
import os
import re
import json
import time
import argparse
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

# Add project root to path so we can import the playlists module
# We'll parse the TS file directly with regex since Python can't import TS

TIMEOUT = 10  # seconds per URL
MAX_WORKERS = 30  # parallel requests

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18',
    'Accept': '*/*',
}

# ─── Playlist definitions (mirrors src/lib/playlists.ts) ────────────────────
# We define them here in Python to avoid TS import complexity.
# Format: (provider_id, category_id, playlist_id_or_none, name, url, output_filename)

PLAYLISTS = [
    # IPTV4ON (local file)
    ('iptv4on', 'all', None, 'IPTV4ON All', '/iptv4on.m3u', 'iptv4on-all.m3u'),

    # World IPTV — Verified (the big one, 14000+ channels)
    ('world-iptv', 'verified-all', None, 'World IPTV Verified',
     'https://romaxa55.github.io/world_ip_tv/output/index.m3u', 'world-iptv-verified-all.m3u'),

    # beIN Sports — Verified Working (local file)
    ('bein-community', 'verified', None, 'beIN Verified Working',
     '/bein-working.m3u', 'bein-verified.m3u'),

    # IPTV Streams — Pluto TV (these are official free channels, should mostly work)
    ('iptv-streams', 'pluto-tv', 's-us-pluto', 'Pluto TV USA',
     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_pluto.m3u',
     'iptv-streams-pluto-tv-us-pluto.m3u'),
    ('iptv-streams', 'pluto-tv', 's-uk-pluto', 'Pluto TV UK',
     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk_pluto.m3u',
     'iptv-streams-pluto-tv-uk-pluto.m3u'),
    ('iptv-streams', 'pluto-tv', 's-de-pluto', 'Pluto TV Germany',
     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de_pluto.m3u',
     'iptv-streams-pluto-tv-de-pluto.m3u'),
    ('iptv-streams', 'pluto-tv', 's-es-pluto', 'Pluto TV Spain',
     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es_pluto.m3u',
     'iptv-streams-pluto-tv-es-pluto.m3u'),
    ('iptv-streams', 'pluto-tv', 's-fr-pluto', 'Pluto TV France',
     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_pluto.m3u',
     'iptv-streams-pluto-tv-fr-pluto.m3u'),

    # IPTV Streams — Samsung TV Plus (also official free channels)
    ('iptv-streams', 'samsung-tv', 's-us-samsung', 'Samsung TV USA',
     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_samsung.m3u',
     'iptv-streams-samsung-tv-us-samsung.m3u'),
    ('iptv-streams', 'samsung-tv', 's-uk-samsung', 'Samsung TV UK',
     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk_samsung.m3u',
     'iptv-streams-samsung-tv-uk-samsung.m3u'),
    ('iptv-streams', 'samsung-tv', 's-de-samsung', 'Samsung TV Germany',
     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de_samsung.m3u',
     'iptv-streams-samsung-tv-de-samsung.m3u'),

    # Free-TV (aggregated Pluto/Plex/Samsung)
    ('free-tv', 'all', None, 'Free-TV All',
     'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
     'free-tv-all.m3u'),
]


def check_url(url):
    """Test a single stream URL. Returns (works: bool, reason: str)."""
    try:
        is_hls = '.m3u8' in url.lower() or url.lower().endswith('.ts')

        if is_hls and '.m3u8' in url.lower():
            # HLS stream — fetch manifest
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
            if r.status_code != 200:
                return False, f'HTTP {r.status_code}'
            body = b''
            try:
                for chunk in r.iter_content(chunk_size=4096):
                    body += chunk
                    if len(body) >= 4096:
                        break
            except Exception:
                pass
            r.close()
            text = body.decode('utf-8', errors='ignore')

            if '#EXTM3U' not in text:
                return False, 'Not a valid HLS manifest'

            # Check for variant stream
            variant_match = re.search(r'#EXT-X-STREAM-INF[^\n]*\n([^\n]+)', text)
            if variant_match:
                variant_url = variant_match.group(1).strip()
                if not variant_url.startswith('http'):
                    base = url.rsplit('/', 1)[0]
                    variant_url = f'{base}/{variant_url}'
                try:
                    r2 = requests.get(variant_url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
                    if r2.status_code != 200:
                        return False, f'Variant HTTP {r2.status_code}'
                    body2 = b''
                    try:
                        for chunk in r2.iter_content(chunk_size=4096):
                            body2 += chunk
                            if len(body2) >= 4096:
                                break
                    except Exception:
                        pass
                    r2.close()
                    text2 = body2.decode('utf-8', errors='ignore')
                    # Look for .ts segment
                    ts_match = re.search(r'^[^#][^\n]+\.ts', text2, re.MULTILINE)
                    if ts_match:
                        return True, 'HLS master + variant + .ts OK'
                    # Could be encrypted or live — accept if manifest is valid
                    return True, 'HLS master + variant OK'
                except Exception as e:
                    return False, f'Variant error: {type(e).__name__}'
            else:
                # Media playlist
                ts_match = re.search(r'^[^#][^\n]+\.ts', text, re.MULTILINE)
                if ts_match:
                    return True, 'HLS media + .ts OK'
                # Could be a valid live stream without .ts (e.g., fMP4 segments)
                if '#EXTINF' in text:
                    return True, 'HLS media playlist OK'
                return False, 'No segments in manifest'
        else:
            # Direct video file (.ts, .mp4) — HEAD request
            try:
                r = requests.head(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
                if r.status_code == 200:
                    return True, 'HTTP 200 (HEAD)'
                # Try GET if HEAD fails
                r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
                r.close()
                if r.status_code == 200:
                    return True, 'HTTP 200 (GET)'
                return False, f'HTTP {r.status_code}'
            except Exception:
                r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
                r.close()
                if r.status_code == 200:
                    return True, 'HTTP 200 (GET fallback)'
                return False, f'HTTP {r.status_code}'
    except requests.exceptions.Timeout:
        return False, 'Timeout'
    except requests.exceptions.ConnectionError:
        return False, 'Connection error'
    except Exception as e:
        return False, f'{type(e).__name__}'


def parse_m3u(content):
    """Parse M3U and return list of (extinf_line, name, url) tuples."""
    channels = []
    lines = content.split('\n')
    pending_extinf = ''
    pending_name = ''
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('#EXTINF'):
            pending_extinf = line
            comma_idx = line.rfind(',')
            pending_name = line[comma_idx + 1:].strip() if comma_idx != -1 else 'Unknown'
        elif line.startswith('#EXTGRP'):
            # Group on its own line — append to pending extinf
            group = line.slice(7).strip() if hasattr(line, 'slice') else line[7:].strip()
            if pending_extinf and 'group-title' not in pending_extinf:
                pending_extinf = pending_extinf.rstrip(',') + f' group-title="{group}",'
                # Actually just keep it simple — preserve original extinf
        elif line.startswith('#'):
            continue
        else:
            # URL line
            channels.append({
                'extinf': pending_extinf,
                'name': pending_name,
                'url': line,
            })
            pending_extinf = ''
            pending_name = ''
    return channels


def fetch_playlist(url):
    """Fetch playlist content. Support local /public/ paths."""
    if url.startswith('/') and not url.startswith('//'):
        # Local file in public/
        local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', url.lstrip('/'))
        with open(local_path, 'r', encoding='utf-8') as f:
            return f.read()
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def check_playlist(provider, category, playlist, name, url, output_file, limit=None):
    """Check all channels in a playlist. Save filtered version with only working channels."""
    print(f'\n{"=" * 80}')
    print(f'Checking: {name}')
    print(f'URL: {url}')
    print(f'{"=" * 80}')

    try:
        content = fetch_playlist(url)
    except Exception as e:
        print(f'  ❌ FAILED to fetch playlist: {e}')
        return {'name': name, 'url': url, 'total': 0, 'working': 0, 'dead': 0, 'error': str(e)}

    channels = parse_m3u(content)
    total = len(channels)
    print(f'  Total channels parsed: {total}')

    if limit and total > limit:
        channels_to_test = channels[:limit]
        print(f'  ⚠️  Limiting to first {limit} channels for testing')
    else:
        channels_to_test = channels

    print(f'  Testing {len(channels_to_test)} channels with {MAX_WORKERS} parallel workers...')

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
            if done % 50 == 0:
                print(f'    Progress: {done}/{len(channels_to_test)} checked...')

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

    # Print sample of working channels
    if working:
        print(f'\n  Sample working channels:')
        for ch in working[:5]:
            print(f'    ✅ {ch["name"][:60]}')
        if len(working) > 5:
            print(f'    ... and {len(working) - 5} more')

    # Print sample of dead channels
    if dead:
        print(f'\n  Sample dead channels:')
        for ch, reason in dead[:5]:
            print(f'    ❌ {ch["name"][:60]} | {reason}')

    # Save filtered M3U file (only working channels)
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
        print(f'\n  💾 Filtered file saved: public/filtered/{output_file} ({len(working)} channels)')
    else:
        print(f'\n  ⚠️  No working channels — no filtered file generated')

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
    parser = argparse.ArgumentParser(description='Check all streams in all playlists')
    parser.add_argument('--provider', help='Only check playlists from this provider')
    parser.add_argument('--limit', type=int, help='Max channels to test per playlist')
    args = parser.parse_args()

    print('🔍 StreamDeck Comprehensive Stream Checker')
    print(f'   Timeout per URL: {TIMEOUT}s | Parallel workers: {MAX_WORKERS}')
    if args.limit:
        print(f'   Limit: {args.limit} channels per playlist')
    print()

    to_check = [p for p in PLAYLISTS if not args.provider or p[0] == args.provider]

    all_results = []
    start_time = time.time()

    for provider, category, playlist, name, url, output_file in to_check:
        result = check_playlist(provider, category, playlist, name, url, output_file, limit=args.limit)
        all_results.append(result)

    elapsed = time.time() - start_time

    # Final summary
    print(f'\n{"=" * 80}')
    print(f'FINAL SUMMARY (took {elapsed:.0f}s)')
    print(f'{"=" * 80}')
    print(f'{"Playlist":<35} {"Total":<8} {"Tested":<8} {"Working":<8} {"Dead":<8}')
    print('-' * 80)
    total_working = 0
    total_tested = 0
    for r in all_results:
        if 'error' in r:
            print(f'{r["name"]:<35} {"ERR":<8} {"-":<8} {"-":<8} {"-":<8} ({r["error"][:20]})')
        else:
            print(f'{r["name"]:<35} {r["total"]:<8} {r["tested"]:<8} {r["working"]:<8} {r["dead"]:<8}')
            total_working += r['working']
            total_tested += r['tested']
    print('-' * 80)
    print(f'{"TOTAL":<35} {"":<8} {total_tested:<8} {total_working:<8} {total_tested - total_working:<8}')

    # Save summary
    summary_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'check-all-results.json')
    with open(summary_path, 'w') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f'\nDetailed results: {summary_path}')


if __name__ == '__main__':
    main()
