#!/usr/bin/env python3
"""
Provider-by-Provider Channel Analyzer
Scans EVERY provider, EVERY category, EVERY sub-playlist in the app.
Tests each channel with a 180-second timeout.
Generates filtered M3U files with only working channels.

Output: public/filtered-v2/<provider>-<category>-<playlist>.m3u
"""

import os
import re
import sys
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curate_best_100 import parse_m3u, fetch_source

# 30 second timeout per URL (180s causes processes to run for hours)
TIMEOUT = 30
MAX_WORKERS = 30

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18',
    'Accept': '*/*',
}

# ─── All providers and their subcategories ──────────────────────────────────
# Format: (provider_id, provider_name, category_id, category_name, playlist_id, playlist_name, url)
TARGETS = []

# We'll build this from the playlists.ts structure
# For now, define manually based on current playlists.ts

TARGETS = [
    # Sports (All Types) — by-sport subcategory
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'all-sports', 'All Sports', '/sports/all-sports.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'soccer', 'Soccer', '/sports/soccer.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'general', 'General Sports', '/sports/general-sports.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'combat', 'Combat', '/sports/combat.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'extreme', 'Extreme', '/sports/extreme-outdoor.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'tennis-golf', 'Tennis & Golf', '/sports/tennis-golf.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'racing', 'Racing', '/sports/racing.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'cricket-rugby', 'Cricket & Rugby', '/sports/cricket-rugby.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'hockey', 'Hockey', '/sports/hockey.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'basketball', 'Basketball', '/sports/basketball.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'nfl', 'American Football', '/sports/american-football.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'college', 'College', '/sports/college.m3u'),
    ('sports-all', 'Sports', 'by-sport', 'By Sport', 'baseball', 'Baseball', '/sports/baseball.m3u'),

    # Best of FreeStream
    ('best-of', 'Best of', 'trending', 'Trending', None, 'Trending', '/curated/sports.m3u'),  # Trending uses sports as base
    ('best-of', 'Best of', 'sports', 'Sports', None, 'Sports', '/curated/sports.m3u'),
    ('best-of', 'Best of', 'movies', 'Movies', None, 'Movies', '/curated/movies.m3u'),
    ('best-of', 'Best of', 'news', 'News', None, 'News', '/curated/news.m3u'),
    ('best-of', 'Best of', 'music', 'Music', None, 'Music', '/curated/music.m3u'),
    ('best-of', 'Best of', 'kids', 'Kids', None, 'Kids', '/curated/kids.m3u'),
    ('best-of', 'Best of', 'entertainment', 'Entertainment', None, 'Entertainment', '/curated/entertainment.m3u'),
    ('best-of', 'Best of', 'documentary', 'Documentary', None, 'Documentary', '/curated/documentary.m3u'),
    ('best-of', 'Best of', 'international', 'International', None, 'International', '/curated/international.m3u'),
    ('best-of', 'Best of', 'religious', 'Religious', None, 'Religious', '/curated/religious.m3u'),
    ('best-of', 'Best of', 'education', 'Education', None, 'Education', '/curated/education.m3u'),

    # Leagues
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'premier-league', 'Premier League', '/leagues/premier-league.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'la-liga', 'La Liga', '/leagues/la-liga.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'champions-league', 'Champions League', '/leagues/champions-league.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'europa-league', 'Europa League', '/leagues/europa-league.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'world-cup-2026', 'World Cup 2026', '/leagues/world-cup-2026.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'other-football', 'Other Football', '/leagues/other-football.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'nfl', 'NFL', '/leagues/nfl.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'nba', 'NBA', '/leagues/nba.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'mlb', 'MLB', '/leagues/mlb.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'nhl', 'NHL', '/leagues/nhl.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'ufc-mma', 'UFC & MMA', '/leagues/ufc-mma.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'f1-racing', 'F1 & Motorsport', '/leagues/f1-racing.m3u'),
    ('leagues', 'Leagues', 'all-leagues', 'By League', 'college-sports', 'College NCAA', '/leagues/college-sports.m3u'),

    # Countries (top 20)
    ('countries', 'Countries', 'all-countries', 'By Country', 'it', 'Italy', '/countries/it.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'id', 'Indonesia', '/countries/id.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'us', 'United States', '/countries/us.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'es', 'Spain', '/countries/es.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'gr', 'Greece', '/countries/gr.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'cz', 'Czech Republic', '/countries/cz.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'ru', 'Russia', '/countries/ru.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'in', 'India', '/countries/in.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'fr', 'France', '/countries/fr.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'gb', 'United Kingdom', '/countries/gb.m3u'),
    ('countries', 'Countries', 'all-countries', 'By Country', 'de', 'Germany', '/countries/de.m3u'),

    # World Regions
    ('world-regions', 'World Regions', 'all-regions', 'By Region', 'europe', 'Europe', '/regions/europe.m3u'),
    ('world-regions', 'World Regions', 'all-regions', 'By Region', 'east-southeast-asia', 'East & SE Asia', '/regions/east-southeast-asia.m3u'),
    ('world-regions', 'World Regions', 'all-regions', 'By Region', 'north-america', 'North America', '/regions/north-america.m3u'),
    ('world-regions', 'World Regions', 'all-regions', 'By Region', 'middle-east-north-africa', 'MENA', '/regions/middle-east-north-africa.m3u'),
    ('world-regions', 'World Regions', 'all-regions', 'By Region', 'south-central-america', 'South & Central America', '/regions/south-central-america.m3u'),
    ('world-regions', 'World Regions', 'all-regions', 'By Region', 'south-asia', 'South Asia', '/regions/south-asia.m3u'),

    # Pluto TV
    ('pluto-tv', 'Pluto TV', 'by-country', 'By Country', 'us', 'USA', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_pluto.m3u'),
    ('pluto-tv', 'Pluto TV', 'by-country', 'By Country', 'uk', 'UK', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk_pluto.m3u'),
    ('pluto-tv', 'Pluto TV', 'by-country', 'By Country', 'de', 'Germany', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de_pluto.m3u'),
    ('pluto-tv', 'Pluto TV', 'by-country', 'By Country', 'es', 'Spain', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es_pluto.m3u'),
    ('pluto-tv', 'Pluto TV', 'by-country', 'By Country', 'fr', 'France', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_pluto.m3u'),

    # LG Channels (top 10)
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'us', 'USA', 'https://www.apsattv.com/uslg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'gb', 'UK', 'https://www.apsattv.com/gblg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'de', 'Germany', 'https://www.apsattv.com/delg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'fr', 'France', 'https://www.apsattv.com/frlg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'es', 'Spain', 'https://www.apsattv.com/eslg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'it', 'Italy', 'https://www.apsattv.com/itlg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'br', 'Brazil', 'https://www.apsattv.com/brlg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'in', 'India', 'https://www.apsattv.com/inlg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'jp', 'Japan', 'https://www.apsattv.com/jplg.m3u'),
    ('lg-channels', 'LG Channels', 'by-country', 'By Country', 'kr', 'Korea', 'https://www.apsattv.com/krlg.m3u'),

    # Samsung TV Plus
    ('samsung-tv', 'Samsung TV', 'by-country', 'By Country', 'us', 'USA', '/filtered/iptv-streams-samsung-tv-us-samsung.m3u'),
    ('samsung-tv', 'Samsung TV', 'by-country', 'By Country', 'uk', 'UK', '/filtered/iptv-streams-samsung-tv-uk-samsung.m3u'),

    # Other FAST platforms
    ('vizio', 'Vizio', 'all', 'All', None, 'All', 'https://www.apsattv.com/vizio.m3u'),
    ('xumo', 'Xumo', 'all', 'All', None, 'All', 'https://www.apsattv.com/xumo.m3u'),
    ('tubi', 'Tubi', 'all', 'All', None, 'All', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u'),
    ('roku', 'Roku', 'all', 'All', None, 'All', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u'),
    ('rakuten-uk', 'Rakuten UK', 'by-country', 'UK', None, 'UK', 'https://www.apsattv.com/rakutentv-uk.m3u'),

    # Free-TV Aggregated
    ('free-tv', 'Free-TV', 'all', 'All', None, 'All', '/filtered/free-tv-all.m3u'),

    # World IPTV
    ('world-iptv', 'World IPTV', 'verified', 'Verified', None, 'Verified', '/filtered/world-iptv-verified-all.m3u'),

    # IPTV4ON
    ('iptv4on', 'IPTV4ON', 'all', 'All', None, 'All', '/filtered/iptv4on-all.m3u'),

    # FAST IPTV
    ('fast-iptv', 'FAST IPTV', 'world-cup', 'World Cup', 'fifa', 'FIFA BDIX', '/filtered/fast-iptv-world-cup-f-fifa.m3u'),
    ('fast-iptv', 'FAST IPTV', 'world-cup', 'World Cup', 'combined', 'Combined Sports', '/filtered/fast-iptv-world-cup-f-combined.m3u'),
    ('fast-iptv', 'FAST IPTV', 'by-country', 'By Country', 'play', 'Indonesia Play', '/filtered/fast-iptv-countries-f-play.m3u'),
    ('fast-iptv', 'FAST IPTV', 'by-country', 'By Country', 'indian', 'Indian', '/filtered/fast-iptv-countries-f-indian.m3u'),
    ('fast-iptv', 'FAST IPTV', 'content', 'Movies', 'movies', 'Movies', '/filtered/fast-iptv-content-f-movies.m3u'),
    ('fast-iptv', 'FAST IPTV', 'content', 'Direct', 'direct', 'Direct M3U', '/filtered/fast-iptv-content-f-direct.m3u'),
    ('fast-iptv', 'FAST IPTV', 'content', 'Channels', 'channels', 'Channels', '/filtered/fast-iptv-content-f-channels.m3u'),

    # beIN Sports
    ('bein', 'beIN Sports', 'verified', 'Verified', None, 'Verified', '/filtered/bein-verified.m3u'),
]


def check_url(url):
    """Test a stream URL with 180s timeout."""
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
            if '#EXT-X-STREAM-INF' in text:
                return True, 'HLS master'
            if '#EXTINF' in text:
                return True, 'HLS media'
            return False, 'Empty manifest'
        else:
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
        return False, 'Timeout (180s)'
    except requests.exceptions.ConnectionError:
        return False, 'Connection error'
    except Exception as e:
        return False, type(e).__name__


def main():
    print('🔍 FreeStream TV — Provider-by-Provider Analyzer')
    print(f'   {len(TARGETS)} playlists to analyze')
    print(f'   Timeout: {TIMEOUT}s per URL | Workers: {MAX_WORKERS}')
    print()

    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'filtered-v2')
    os.makedirs(output_dir, exist_ok=True)

    all_results = []
    start_time = time.time()

    for i, (prov_id, prov_name, cat_id, cat_name, pl_id, pl_name, url) in enumerate(TARGETS):
        label = f'{prov_name} → {cat_name}'
        if pl_name and pl_name != cat_name:
            label += f' → {pl_name}'

        print(f'\n[{i+1}/{len(TARGETS)}] {label}')
        print(f'  URL: {url}')

        try:
            content = fetch_source(url)
            channels = parse_m3u(content)
            print(f'  Channels: {len(channels)}')

            if len(channels) == 0:
                print(f'  ⚠️ Empty playlist — skipping')
                all_results.append({
                    'provider': prov_name, 'category': cat_name, 'playlist': pl_name,
                    'url': url, 'total': 0, 'working': 0, 'dead': 0, 'file': None,
                })
                continue

            # Test all channels
            results = {}
            def check_one(idx_ch):
                idx, ch = idx_ch
                works, reason = check_url(ch['url'])
                return idx, works, reason

            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                futures = {executor.submit(check_one, (j, ch)): j for j, ch in enumerate(channels)}
                done = 0
                for future in as_completed(futures):
                    idx, works, reason = future.result()
                    results[idx] = (works, reason)
                    done += 1
                    if done % 25 == 0:
                        pct = done * 100 // len(channels)
                        print(f'  Progress: {done}/{len(channels)} ({pct}%)')

            working = []
            dead = []
            for idx, ch in enumerate(channels):
                if idx in results:
                    if results[idx][0]:
                        working.append(ch)
                    else:
                        dead.append((ch, results[idx][1]))

            print(f'  ✅ Working: {len(working)} | ❌ Dead: {len(dead)}')

            # Save filtered file
            output_file = f'{prov_id}-{cat_id}'
            if pl_id:
                output_file += f'-{pl_id}'
            output_file += '.m3u'
            output_path = os.path.join(output_dir, output_file)

            if working:
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(f'#EXTM3U\n# {label} — {len(working)}/{len(channels)} working\n')
                    seen = set()
                    for ch in working:
                        if ch['url'] not in seen:
                            f.write(f'{ch["extinf"]}\n')
                            f.write(f'{ch["url"]}\n')
                            seen.add(ch['url'])
                print(f'  💾 Saved: public/filtered-v2/{output_file}')

            all_results.append({
                'provider': prov_name,
                'category': cat_name,
                'playlist': pl_name,
                'url': url,
                'total': len(channels),
                'working': len(working),
                'dead': len(dead),
                'file': output_file if working else None,
                'pct': round(len(working) * 100 / len(channels), 1) if channels else 0,
            })

        except Exception as e:
            print(f'  ❌ Failed: {e}')
            all_results.append({
                'provider': prov_name, 'category': cat_name, 'playlist': pl_name,
                'url': url, 'total': 0, 'working': 0, 'dead': 0, 'file': None, 'error': str(e),
            })

    elapsed = time.time() - start_time

    # Final summary
    print(f'\n{"=" * 80}')
    print(f'🔍 PROVIDER-BY-PROVIDER ANALYSIS COMPLETE')
    print(f'   Took {elapsed/60:.1f} minutes')
    print(f'{"=" * 80}')
    print(f'{"Provider":<15} {"Category":<15} {"Playlist":<20} {"Total":<8} {"Working":<8} {"Dead":<8} {"%":<6}')
    print('-' * 80)
    total_all = 0
    total_working = 0
    total_dead = 0
    for r in all_results:
        pl = r.get('playlist', '') or ''
        print(f'{r["provider"]:<15} {r["category"]:<15} {pl:<20} {r["total"]:<8} {r["working"]:<8} {r["dead"]:<8} {r.get("pct", 0):<6}')
        total_all += r['total']
        total_working += r['working']
        total_dead += r['dead']
    print('-' * 80)
    print(f'{"TOTAL":<15} {"":<15} {"":<20} {total_all:<8} {total_working:<8} {total_dead:<8} {round(total_working*100/total_all if total_all else 0, 1):<6}')

    # Save detailed results
    results_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'provider-analysis.json')
    with open(results_path, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f'\nDetailed results: {results_path}')


if __name__ == '__main__':
    main()
