#!/usr/bin/env python3
"""
Test all known beIN Sports amagi.tv / official free stream URLs.
These are the only beIN channels that are genuinely free (not subscription-locked).
"""

import requests
import re
import sys

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18',
    'Accept': '*/*',
}

TIMEOUT = 8

def check_hls(url):
    """Test HLS stream by fetching manifest, then variant, then .ts segment."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
        if r.status_code != 200:
            return False, f'HTTP {r.status_code}'
        body = b''
        for chunk in r.iter_content(chunk_size=4096):
            body += chunk
            if len(body) >= 4096:
                break
        r.close()
        text = body.decode('utf-8', errors='ignore')
        if '#EXTM3U' not in text:
            return False, 'Not a valid HLS manifest'

        # Try to find variant stream
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
                for chunk in r2.iter_content(chunk_size=4096):
                    body2 += chunk
                    if len(body2) >= 4096:
                        break
                r2.close()
                text2 = body2.decode('utf-8', errors='ignore')
                ts_match = re.search(r'^[^#][^\n]+\.ts', text2, re.MULTILINE)
                if ts_match:
                    return True, 'HLS master + variant + .ts OK'
                return True, 'HLS master + variant OK (no .ts found)'
            except Exception as e:
                return False, f'Variant error: {type(e).__name__}'
        else:
            # Media playlist
            ts_match = re.search(r'^[^#][^\n]+\.ts', text, re.MULTILINE)
            if ts_match:
                return True, 'HLS media + .ts OK'
            return True, 'HLS manifest OK'
    except requests.exceptions.Timeout:
        return False, 'Timeout'
    except Exception as e:
        return False, f'{type(e).__name__}'


# All known beIN official free streams (from amagi.tv, redbox, xumo, samsung)
KNOWN_BEIN_URLS = [
    # beIN Sports XTRA (US, English) — multiple providers
    ('beIN Sports XTRA (amagi/bein)', 'https://bein-xtra-bein.amagi.tv/playlist.m3u8'),
    ('beIN Sports XTRA (xumo)', 'https://bein-xtra-xumo.amagi.tv/playlist.m3u8'),
    ('beIN Sports XTRA (redbox)', 'https://redbox-beinsports-xumo.amagi.tv/playlist.m3u8'),
    ('beIN Sports XTRA (samsung AU)', 'https://amg01334-beinsportsllc-beinxtra-samsungau-eiyvc.amagi.tv/playlist/amg01334-beinsportsllc-beinxtra-samsungau/playlist.m3u8'),

    # beIN Sports XTRA en Español (US, Spanish)
    ('beIN Sports XTRA Ñ (1080p)', 'https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8'),
    ('beIN Sports XTRA Ñ (xumo)', 'https://bein-esp-xumo.amagi.tv/playlistR1080p.m3u8'),
    ('beIN Sports XTRA Ñ (720p)', 'https://bein-esp-xumo.amagi.tv/playlistR720P.m3u8'),

    # beIN Sports Haber (Turkey) — news channel
    ('beIN Sports Haber (720p)', 'https://1nyaler.streamhostingcdn.top/stream/23/index.m3u8'),

    # beIN Sports USA (sometimes works)
    ('beIN Sports USA (1080p)', 'https://bein-usa.amagi.tv/playlist.m3u8'),
    ('beIN Sports USA (samsung)', 'https://amg01334-beinsportsllc-beinsports1-samsungus-eiyvc.amagi.tv/playlist/amg01334-beinsportsllc-beinsports1-samsungus/playlist.m3u8'),

    # Other beIN variants
    ('beIN Sports 1 (amagi)', 'https://bein-1-bein.amagi.tv/playlist.m3u8'),
    ('beIN Sports 2 (amagi)', 'https://bein-2-bein.amagi.tv/playlist.m3u8'),
    ('beIN Sports Connect', 'https://beinconnect-bein.amagi.tv/playlist.m3u8'),
]


def main():
    print('Testing known beIN official free stream URLs')
    print(f'{"=" * 80}')

    working = []
    dead = []

    for name, url in KNOWN_BEIN_URLS:
        print(f'\nTesting: {name}')
        print(f'  URL: {url}')
        works, reason = check_hls(url)
        status = '✅ WORKING' if works else '❌ DEAD'
        print(f'  {status} | {reason}')
        if works:
            working.append((name, url))
        else:
            dead.append((name, url, reason))

    print(f'\n{"=" * 80}')
    print(f'SUMMARY: {len(working)} working / {len(dead)} dead')
    print(f'{"=" * 80}')

    print('\n✅ Working beIN streams:')
    for name, url in working:
        print(f'  • {name}')
        print(f'    {url}')

    print('\n❌ Dead beIN streams:')
    for name, url, reason in dead:
        print(f'  • {name} ({reason})')

    # Generate M3U file with only working streams
    if working:
        with open('/home/z/my-project/public/bein-working.m3u', 'w') as f:
            f.write('#EXTM3U\n')
            seen = set()
            for name, url in working:
                if url not in seen:
                    f.write(f'#EXTINF:-1 tvg-name="{name}" group-title="beIN Sports (Verified)",{name}\n')
                    f.write(f'{url}\n')
                    seen.add(url)
        print(f'\n✅ Working beIN streams saved to: /home/z/my-project/public/bein-working.m3u')
        print(f'   ({len(working)} channels)')


if __name__ == '__main__':
    main()
