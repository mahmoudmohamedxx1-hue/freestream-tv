#!/usr/bin/env python3
"""
Best 100 Curator — builds genre-based "best of" playlists.

For each genre (Sports, News, Movies, Music, Kids, Entertainment, Documentary,
Religious, Culture, Education), this script:
1. Pulls channels from multiple trusted sources (LG US, Samsung US, Pluto US,
   World IPTV verified, beIN verified, FAST IPTV verified)
2. Filters by genre keywords in the channel name/group
3. Deduplicates by URL
4. Tests each candidate (HTTP HEAD + HLS manifest check)
5. Saves the top 100 WORKING channels per genre to public/curated/<genre>.m3u

The result: a "Best of FreeStream" provider where every channel is verified
working and organized by what users actually want to watch.
"""

import os
import re
import sys
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

TIMEOUT = 8
MAX_WORKERS = 25

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18',
    'Accept': '*/*',
}

# ─── Sources to pull from (in priority order) ────────────────────────────────
SOURCES = [
    # Local filtered files (already verified once)
    ('LG US', 'https://www.apsattv.com/uslg.m3u'),
    ('Samsung US', '/filtered/iptv-streams-samsung-tv-us-samsung.m3u'),
    ('Pluto US', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_pluto.m3u'),
    ('World Verified', '/filtered/world-iptv-verified-all.m3u'),
    ('Free-TV', '/filtered/free-tv-all.m3u'),
    ('beIN', '/filtered/bein-verified.m3u'),
    ('FAST IPTV Combined', '/filtered/fast-iptv-world-cup-f-combined.m3u'),
    ('FAST IPTV Direct', '/filtered/fast-iptv-content-f-direct.m3u'),
    ('FAST IPTV Channels', '/filtered/fast-iptv-content-f-channels.m3u'),
    ('FAST IPTV Play', '/filtered/fast-iptv-countries-f-play.m3u'),
    ('FAST IPTV Movies', '/filtered/fast-iptv-content-f-movies.m3u'),
    ('IPTV4ON', '/filtered/iptv4on-all.m3u'),
    ('Tubi', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u'),
    ('Roku', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u'),
    ('Vizio', 'https://www.apsattv.com/vizio.m3u'),
    ('Xumo', 'https://www.apsattv.com/xumo.m3u'),
    ('TCL', 'https://www.apsattv.com/tclplus.m3u'),
    ('LocalNow', 'https://www.apsattv.com/localnow.m3u'),
]

# ─── Genre definitions ──────────────────────────────────────────────────────
# Each genre has keywords to match against channel name + group + categories.
# The first matching keyword wins (priority order).
GENRES = [
    {
        'id': 'sports',
        'name': 'Sports',
        'flag': '⚽',
        'keywords': ['sport', 'espn', 'bein', 'fifa', 'nba', 'nfl', 'mlb', 'nhl',
                     'ufc', 'wwe', 'golf', 'tennis', 'boxing', 'racing', 'football',
                     'soccer', 'basketball', 'baseball', 'hockey', 'cricket', 'olympic',
                     'action sports', 'extreme', 'fishing', 'hunting', 'ncaa', 'premier league',
                     'laliga', 'serie a', 'bundesliga'],
        'exclude': ['news', 'weather'],
    },
    {
        'id': 'news',
        'name': 'News',
        'flag': '📰',
        'keywords': ['news', 'cnn', 'bbc', 'al jazeera', 'aljazeera', 'reuters',
                     'bloomberg', 'fox news', 'msnbc', 'nbc news', 'abc news', 'cbs news',
                     'sky news', 'france 24', 'dw ', 'rt ', 'cgtn', 'nhs', 'euronews',
                     'abc australia', 'sky news australia', 'newsmax', 'oan', 'news nation'],
        'exclude': ['sport news'],
    },
    {
        'id': 'movies',
        'name': 'Movies',
        'flag': '🎬',
        'keywords': ['movie', 'cinema', 'film', 'cine', 'flick', 'hollywood',
                     'bollywood', 'action movie', 'comedy movie', 'drama movie',
                     'horror movie', 'classic movie', 'western', 'thriller',
                     'movie channel', 'movieplex', 'moviestime'],
        'exclude': ['news', 'sport'],
    },
    {
        'id': 'music',
        'name': 'Music',
        'flag': '🎵',
        'keywords': ['music', 'mtv', 'vh1', 'bet ', 'country music', 'classical music',
                     'jazz', 'rock', 'pop music', 'hip hop', 'rap', 'reggae',
                     'music video', 'concert', 'live music', 'song', 'radio',
                     'smooth jazz', 'dance music', 'edm', 'electronic'],
        'exclude': ['news', 'movie'],
    },
    {
        'id': 'kids',
        'name': 'Kids',
        'flag': '👶',
        'keywords': ['kids', 'kid ', 'child', 'cartoon', 'anime', 'disney',
                     'nick', 'nickelodeon', 'pbs kids', 'baby', 'toddler',
                     'family', 'teen', 'junior', 'toon', 'barney', 'sesame',
                     'mickey', 'peppa', 'paw patrol', 'spongebob'],
        'exclude': ['news', 'sport'],
    },
    {
        'id': 'entertainment',
        'name': 'Entertainment',
        'flag': '🎪',
        'keywords': ['entertainment', 'reality', 'game show', 'talk show',
                     'lifestyle', 'cooking', 'food', 'travel', 'home',
                     'diy', 'design', 'fashion', 'beauty', 'wedding',
                     'gossip', 'celebrity', 'drama', 'comedy', 'sitcom'],
        'exclude': ['news', 'sport', 'movie', 'kids'],
    },
    {
        'id': 'documentary',
        'name': 'Documentary',
        'flag': '🔬',
        'keywords': ['documentary', 'discovery', 'national geographic', 'nat geo',
                     'history', 'science', 'nature', 'wildlife', 'animal',
                     'planet', 'smithsonian', 'curiosity', 'space', 'tech',
                     'investigation', 'crime'],
        'exclude': ['news', 'sport'],
    },
    {
        'id': 'religious',
        'name': 'Religious',
        'flag': '🕌',
        'keywords': ['religious', 'islam', 'muslim', 'quran', 'christian',
                     'catholic', 'bible', 'church', 'jesus', 'god',
                     'prayer', 'faith', 'gospel', 'ministry', 'spiritual',
                     'buddha', 'hindu', 'jewish'],
        'exclude': ['news', 'sport'],
    },
    {
        'id': 'education',
        'name': 'Education',
        'flag': '🎓',
        'keywords': ['education', 'learn', 'history channel', 'science channel',
                     'pbs ', 'lecture', 'university', 'course', 'academic',
                     'knowledge', 'documentary channel', 'how to', 'tutorial'],
        'exclude': ['news', 'sport'],
    },
    {
        'id': 'international',
        'name': 'International',
        'flag': '🌍',
        'keywords': ['international', 'world', 'global', 'arabic', 'french',
                     'german', 'spanish', 'chinese', 'japanese', 'korean',
                     'indian', 'russian', 'turkish', 'persian', 'urdu',
                     'hindi', 'bengali', 'vietnamese', 'thai', 'filipino'],
        'exclude': [],
    },
]


def check_url(url):
    """Test if a stream URL works. Returns (works, reason)."""
    try:
        is_hls = '.m3u8' in url.lower()
        if is_hls:
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
                return False, 'Not HLS'
            # Check for variant or .ts segments
            if '#EXT-X-STREAM-INF' in text:
                return True, 'HLS master'
            if re.search(r'^[^#][^\n]+\.ts', text, re.MULTILINE):
                return True, 'HLS media + .ts'
            if '#EXTINF' in text:
                return True, 'HLS media'
            return False, 'Empty manifest'
        else:
            # Direct file (mp4, ts) — HEAD check
            try:
                r = requests.head(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
                if r.status_code == 200:
                    return True, 'HTTP 200'
                r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
                r.close()
                if r.status_code == 200:
                    return True, 'HTTP 200 GET'
                return False, f'HTTP {r.status_code}'
            except Exception:
                r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
                r.close()
                return (r.status_code == 200, f'HTTP {r.status_code}')
    except requests.exceptions.Timeout:
        return False, 'Timeout'
    except requests.exceptions.ConnectionError:
        return False, 'Conn error'
    except Exception as e:
        return False, type(e).__name__


def parse_m3u(content):
    """Parse M3U, return list of {extinf, name, url, group}."""
    channels = []
    lines = content.split('\n')
    pending_extinf = ''
    pending_name = ''
    pending_group = ''
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('#EXTINF'):
            pending_extinf = line
            comma_idx = line.rfind(',')
            pending_name = line[comma_idx + 1:].strip() if comma_idx != -1 else 'Unknown'
            grp_match = re.search(r'group-title="([^"]+)"', line)
            pending_group = grp_match.group(1) if grp_match else ''
        elif line.startswith('#'):
            continue
        else:
            channels.append({
                'extinf': pending_extinf,
                'name': pending_name,
                'url': line,
                'group': pending_group,
            })
            pending_extinf = ''
            pending_name = ''
            pending_group = ''
    return channels


def fetch_source(url):
    """Fetch M3U content. Support local /public/ paths."""
    if url.startswith('/') and not url.startswith('//'):
        local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', url.lstrip('/'))
        with open(local_path, 'r', encoding='utf-8') as f:
            return f.read()
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def classify_channel(name, group):
    """Determine which genre a channel belongs to. Returns genre_id or None."""
    text = f'{name} {group}'.lower()
    for genre in GENRES:
        # Check exclusions first
        excluded = False
        for ex in genre['exclude']:
            if ex in text:
                excluded = True
                break
        if excluded:
            continue
        # Check keywords
        for kw in genre['keywords']:
            if kw in text:
                return genre['id']
    return None


def main():
    print('🎯 FreeStream TV — Best 100 Curator')
    print(f'   Testing {len(GENRES)} genres × 100 channels = up to {len(GENRES) * 100} curated channels')
    print(f'   Timeout: {TIMEOUT}s | Workers: {MAX_WORKERS}')
    print()

    # Step 1: Fetch all sources and classify channels by genre
    genre_candidates = {g['id']: [] for g in GENRES}
    seen_urls = set()

    for source_name, source_url in SOURCES:
        print(f'📥 Fetching: {source_name}')
        try:
            content = fetch_source(source_url)
            channels = parse_m3u(content)
            print(f'   {len(channels)} channels parsed')
            classified = 0
            for ch in channels:
                if ch['url'] in seen_urls:
                    continue
                seen_urls.add(ch['url'])
                genre_id = classify_channel(ch['name'], ch['group'])
                if genre_id:
                    genre_candidates[genre_id].append({
                        **ch,
                        'source': source_name,
                    })
                    classified += 1
            print(f'   {classified} channels classified into genres')
        except Exception as e:
            print(f'   ❌ Failed: {e}')

    print()
    print('📊 Candidates per genre (before testing):')
    for g in GENRES:
        print(f'   {g["flag"]} {g["name"]}: {len(genre_candidates[g["id"]])} candidates')

    # Step 2: Test each genre's candidates (up to 150 to find 100 working)
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'curated')
    os.makedirs(output_dir, exist_ok=True)

    summary = []
    for g in GENRES:
        candidates = genre_candidates[g['id']]
        target = 100
        test_limit = min(len(candidates), 200)  # Test up to 200 to find 100 working
        candidates_to_test = candidates[:test_limit]

        print(f'\n🎯 Testing {g["flag"]} {g["name"]}: {len(candidates_to_test)} candidates (need {target})')

        results = {}
        def check_one(idx_ch):
            idx, ch = idx_ch
            works, reason = check_url(ch['url'])
            return idx, works, reason

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(check_one, (i, ch)): i for i, ch in enumerate(candidates_to_test)}
            done = 0
            for future in as_completed(futures):
                idx, works, reason = future.result()
                results[idx] = (works, reason)
                done += 1
                if done % 25 == 0:
                    print(f'   Progress: {done}/{len(candidates_to_test)}')

        working = []
        for idx, ch in enumerate(candidates_to_test):
            if idx in results and results[idx][0]:
                working.append(ch)
                if len(working) >= target:
                    break

        print(f'   ✅ {len(working)} working channels found')

        # Save curated M3U
        output_file = f'{g["id"]}.m3u'
        output_path = os.path.join(output_dir, output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f'#EXTM3U\n# Best 100 {g["name"]} — curated by FreeStream TV\n')
            seen = set()
            for ch in working:
                if ch['url'] not in seen:
                    f.write(f'{ch["extinf"]}\n')
                    f.write(f'{ch["url"]}\n')
                    seen.add(ch['url'])
        print(f'   💾 Saved: public/curated/{output_file}')

        summary.append({
            'genre': g['name'],
            'flag': g['flag'],
            'candidates': len(candidates),
            'tested': len(candidates_to_test),
            'working': len(working),
            'file': output_file,
        })

    # Final summary
    print(f'\n{"=" * 70}')
    print('🏆 BEST 100 CURATION COMPLETE')
    print(f'{"=" * 70}')
    print(f'{"Genre":<20} {"Candidates":<12} {"Tested":<10} {"Working":<10}')
    print('-' * 70)
    total_working = 0
    for s in summary:
        print(f'{s["flag"]} {s["genre"]:<17} {s["candidates"]:<12} {s["tested"]:<10} {s["working"]:<10}')
        total_working += s['working']
    print('-' * 70)
    print(f'{"TOTAL":<20} {"":<12} {"":<10} {total_working:<10}')

    # Save summary
    summary_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'curated-summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f'\nSummary saved: {summary_path}')


if __name__ == '__main__':
    main()
