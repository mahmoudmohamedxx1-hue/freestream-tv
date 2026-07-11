#!/usr/bin/env python3
"""
Stream checker — tests each channel URL in a playlist and reports which ones work.

A stream is considered "working" if:
1. The HTTP request returns 200 OK (for direct video files)
2. OR it returns a valid HLS manifest (for .m3u8 URLs — content-type contains 'mpegurl' or body starts with #EXTM3U)
3. Within a 8-second timeout

For .m3u8 streams, we also do a second-level check: fetch the first .ts segment URL
from the manifest and verify it returns 200 (this catches manifests that exist but
point to dead segment servers).
"""

import sys
import re
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

TIMEOUT = 8  # seconds per request
MAX_WORKERS = 20  # parallel requests

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18',
    'Accept': '*/*',
}

def check_url(url):
    """Test a single stream URL. Returns (works: bool, reason: str)."""
    try:
        # Step 1: HEAD or GET request
        # Some servers don't support HEAD, so use GET with stream=True and close immediately
        is_hls = '.m3u8' in url.lower()

        if is_hls:
            # For HLS, fetch the manifest
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
            content_type = r.headers.get('content-type', '').lower()
            body_start = b''
            try:
                for chunk in r.iter_content(chunk_size=2048):
                    body_start += chunk
                    if len(body_start) >= 2048:
                        break
            except Exception:
                pass
            r.close()

            if r.status_code != 200:
                return False, f'HTTP {r.status_code}'

            body_text = body_start.decode('utf-8', errors='ignore')

            # Check if it's a valid M3U8 manifest
            if '#EXTM3U' not in body_text and 'mpegurl' not in content_type:
                return False, 'Not a valid HLS manifest'

            # If it's a master playlist with variant streams, try to fetch the first variant
            # Look for #EXT-X-STREAM-INF followed by a URL
            variant_match = re.search(r'#EXT-X-STREAM-INF[^\n]*\n([^\n]+)', body_text)
            if variant_match:
                variant_url = variant_match.group(1).strip()
                # Resolve relative URL
                if not variant_url.startswith('http'):
                    base = url.rsplit('/', 1)[0]
                    variant_url = f'{base}/{variant_url}'

                # Fetch the variant playlist
                try:
                    r2 = requests.get(variant_url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
                    body2_start = b''
                    try:
                        for chunk in r2.iter_content(chunk_size=2048):
                            body2_start += chunk
                            if len(body2_start) >= 2048:
                                break
                    except Exception:
                        pass
                    r2.close()

                    if r2.status_code != 200:
                        return False, f'Variant HTTP {r2.status_code}'

                    body2_text = body2_start.decode('utf-8', errors='ignore')

                    # Check for .ts segments
                    ts_match = re.search(r'^[^#][^\n]+\.ts', body2_text, re.MULTILINE)
                    if ts_match:
                        ts_url = ts_match.group(0).strip()
                        if not ts_url.startswith('http'):
                            base = variant_url.rsplit('/', 1)[0]
                            ts_url = f'{base}/{ts_url}'
                        # Quick HEAD check on the .ts segment
                        try:
                            r3 = requests.head(ts_url, headers=HEADERS, timeout=5, allow_redirects=True)
                            if r3.status_code == 200:
                                return True, 'HLS manifest + variant + .ts segment OK'
                            else:
                                return False, f'TS segment HTTP {r3.status_code}'
                        except Exception as e:
                            return False, f'TS segment error: {type(e).__name__}'
                    else:
                        # No .ts found but manifest is valid — could be a live stream with encryption
                        return True, 'HLS manifest valid (no .ts check needed)'
                except Exception as e:
                    return False, f'Variant error: {type(e).__name__}'
            else:
                # Media playlist directly — check for .ts segments
                ts_match = re.search(r'^[^#][^\n]+\.ts', body_text, re.MULTILINE)
                if ts_match:
                    ts_url = ts_match.group(0).strip()
                    if not ts_url.startswith('http'):
                        base = url.rsplit('/', 1)[0]
                        ts_url = f'{base}/{ts_url}'
                    try:
                        r3 = requests.head(ts_url, headers=HEADERS, timeout=5, allow_redirects=True)
                        if r3.status_code == 200:
                            return True, 'HLS + .ts segment OK'
                        else:
                            return False, f'TS segment HTTP {r3.status_code}'
                    except Exception as e:
                        return False, f'TS segment error: {type(e).__name__}'
                else:
                    return True, 'HLS manifest valid'
        else:
            # Non-HLS (direct .ts, .mp4, etc.) — just check HTTP 200
            r = requests.head(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
            if r.status_code == 200:
                return True, 'HTTP 200'
            else:
                # Try GET instead of HEAD (some servers don't support HEAD)
                r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
                r.close()
                if r.status_code == 200:
                    return True, 'HTTP 200 (GET)'
                return False, f'HTTP {r.status_code}'
    except requests.exceptions.Timeout:
        return False, 'Timeout'
    except requests.exceptions.ConnectionError as e:
        return False, 'Connection error'
    except Exception as e:
        return False, f'{type(e).__name__}: {str(e)[:50]}'


def parse_m3u(content):
    """Simple M3U parser — returns list of (name, url) tuples."""
    channels = []
    lines = content.split('\n')
    pending_name = ''
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('#EXTINF'):
            # Extract name after comma
            comma_idx = line.rfind(',')
            if comma_idx != -1:
                pending_name = line[comma_idx + 1:].strip()
            else:
                pending_name = 'Unknown'
        elif line.startswith('#'):
            continue
        else:
            # URL line
            channels.append((pending_name, line))
            pending_name = ''
    return channels


def check_playlist(name, url, filter_bein=True):
    """Fetch a playlist, parse it, and check each channel. Returns summary."""
    print(f'\n{"=" * 70}')
    print(f'Checking: {name}')
    print(f'URL: {url}')
    print(f'{"=" * 70}')

    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code != 200:
            print(f'  FAILED to fetch playlist: HTTP {r.status_code}')
            return {'name': name, 'url': url, 'total': 0, 'working': 0, 'dead': 0, 'working_channels': [], 'error': f'HTTP {r.status_code}'}
        content = r.text
    except Exception as e:
        print(f'  FAILED to fetch playlist: {e}')
        return {'name': name, 'url': url, 'total': 0, 'working': 0, 'dead': 0, 'working_channels': [], 'error': str(e)}

    channels = parse_m3u(content)
    print(f'  Total channels parsed: {len(channels)}')

    # Filter to beIN channels if requested
    if filter_bein:
        bein_channels = [(n, u) for n, u in channels if 'bein' in n.lower()]
        print(f'  beIN-branded channels: {len(bein_channels)}')
        # Also include non-beIN channels from this playlist if it's a sports pack
        # (some playlists have beIN content under different names)
        test_channels = bein_channels if len(bein_channels) > 0 else channels[:30]
    else:
        test_channels = channels

    # Limit to first 40 to keep test time reasonable
    test_channels = test_channels[:40]
    print(f'  Testing first {len(test_channels)} channels...')

    working = []
    dead = []
    results = {}

    def check_one(idx_name_url):
        idx, (ch_name, ch_url) = idx_name_url
        works, reason = check_url(ch_url)
        return idx, ch_name, ch_url, works, reason

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(check_one, (i, item)): i for i, item in enumerate(test_channels)}
        for future in as_completed(futures):
            idx, ch_name, ch_url, works, reason = future.result()
            results[idx] = (ch_name, ch_url, works, reason)

    for idx in range(len(test_channels)):
        ch_name, ch_url, works, reason = results[idx]
        if works:
            working.append({'name': ch_name, 'url': ch_url, 'reason': reason})
            print(f'  ✅ {ch_name[:50]:<50} | {reason}')
        else:
            dead.append({'name': ch_name, 'url': ch_url, 'reason': reason})
            print(f'  ❌ {ch_name[:50]:<50} | {reason}')

    print(f'\n  Summary: {len(working)} working / {len(dead)} dead / {len(test_channels)} tested')

    return {
        'name': name,
        'url': url,
        'total': len(channels),
        'bein_total': len(bein_channels) if filter_bein else len(channels),
        'tested': len(test_channels),
        'working': len(working),
        'dead': len(dead),
        'working_channels': working,
        'dead_channels': dead,
    }


# ─── Playlists to test ─────────────────────────────────────────────────────
PLAYLISTS = [
    ('Dev-Gaminger Sport Pack', 'https://gist.githubusercontent.com/Dev-Gaminger010/36540530e38d3309000f6ff7a0c65f5f/raw'),
    ('ItsRandall Arabic Sports', 'https://gist.githubusercontent.com/ItsRandall/3119615c8b4732d7b56e5217d66edbab/raw'),
    ('Muhand beIN Sports Pack', 'https://gist.githubusercontent.com/Muhand/cd236a44b2c1019a624a8a58a8ade09f/raw'),
    ('Fazzani beIN VIP + Tunisia', 'https://gist.githubusercontent.com/Fazzani/722f67c30ada8bac4602f62a2aaccff6/raw'),
    ('regragi beIN Sports FR', 'https://gist.githubusercontent.com/regragi-younes/a77b56c45b3c086cc166b79d5cc45e4a/raw'),
    ('rosman83 Arabic IPTV', 'https://gist.githubusercontent.com/rosman83/b362513e881237d7e6110b1dc54f05f5/raw'),
    ('FreeCA TV', 'https://raw.githubusercontent.com/manikiptv/freecatv.github.io/main/freecatv.m3u8'),
    # Also test the iptv-org sports category (official, should have working beIN XTRA)
    ('iptv-org Sports Category', 'https://iptv-org.github.io/iptv/categories/sports.m3u'),
    # And the World IPTV verified playlist
    ('World IPTV Verified', 'https://romaxa55.github.io/world_ip_tv/output/index.m3u'),
]


def main():
    print('Stream Checker — testing beIN playlists')
    print(f'Timeout per URL: {TIMEOUT}s | Parallel workers: {MAX_WORKERS}')

    all_results = []
    for name, url in PLAYLISTS:
        result = check_playlist(name, url, filter_bein=True)
        all_results.append(result)

    # Final summary
    print(f'\n{"=" * 70}')
    print('FINAL SUMMARY')
    print(f'{"=" * 70}')
    print(f'{"Playlist":<35} {"beIN":<6} {"Tested":<8} {"Working":<8} {"Dead":<6}')
    print('-' * 70)
    for r in all_results:
        if 'error' in r:
            print(f'{r["name"]:<35} {"ERR":<6} {"-":<8} {"-":<8} {"-":<6} ({r["error"][:20]})')
        else:
            print(f'{r["name"]:<35} {r["bein_total"]:<6} {r["tested"]:<8} {r["working"]:<8} {r["dead"]:<6}')

    # Save detailed results
    with open('/home/z/my-project/scripts/bein-check-results.json', 'w') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f'\nDetailed results saved to: /home/z/my-project/scripts/bein-check-results.json')

    # Save working channels as a single M3U file
    all_working = []
    for r in all_results:
        for ch in r.get('working_channels', []):
            all_working.append(ch)

    if all_working:
        with open('/home/z/my-project/public/bein-working.m3u', 'w') as f:
            f.write('#EXTM3U\n')
            seen = set()
            for ch in all_working:
                if ch['url'] not in seen:
                    f.write(f'#EXTINF:-1,{ch["name"]}\n')
                    f.write(f'{ch["url"]}\n')
                    seen.add(ch['url'])
        print(f'Working channels ({len(all_working)} total) saved to: /home/z/my-project/public/bein-working.m3u')
    else:
        print('\n⚠️  NO working channels found in any playlist!')


if __name__ == '__main__':
    main()
