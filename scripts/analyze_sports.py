#!/usr/bin/env python3
"""
Comprehensive Sports Analyzer — scans ALL providers, extracts every sports channel,
classifies by sport type, and generates per-sport M3U files.

Sport types:
- Football (American) — NFL, college football
- Soccer — Premier League, La Liga, Serie A, Bundesliga, MLS, etc.
- Basketball — NBA, college, international
- Baseball — MLB
- Hockey — NHL
- Combat — UFC, MMA, WWE, boxing
- Racing — F1, NASCAR, MotoGP, IndyCar
- General Sports — channels that stream ALL sports (ESPN, beIN, Fox Sports, etc.)
- College Sports — NCAA
- Extreme/Outdoor — extreme sports, fishing, hunting
"""

import os
import re
import sys
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curate_best_100 import check_url, parse_m3u, fetch_source, HEADERS, TIMEOUT, MAX_WORKERS

# ─── ALL sources to scan ────────────────────────────────────────────────────
ALL_SOURCES = [
    # Curated
    ('Sports curated', '/curated/sports.m3u'),
    ('Sports Football', '/curated/sports-football.m3u'),
    ('Sports Soccer', '/curated/sports-soccer.m3u'),
    ('Sports Combat', '/curated/sports-combat.m3u'),
    ('Sports Racing', '/curated/sports-racing.m3u'),
    ('Sports College', '/curated/sports-college.m3u'),
    ('Sports General', '/curated/sports-general-sports.m3u'),
    # Leagues
    ('Premier League', '/leagues/premier-league.m3u'),
    ('La Liga', '/leagues/la-liga.m3u'),
    ('Serie A', '/leagues/serie-a.m3u'),
    ('Champions League', '/leagues/champions-league.m3u'),
    ('Europa League', '/leagues/europa-league.m3u'),
    ('World Cup', '/leagues/world-cup-2026.m3u'),
    ('NFL', '/leagues/nfl.m3u'),
    ('NBA', '/leagues/nba.m3u'),
    ('MLB', '/leagues/mlb.m3u'),
    ('NHL', '/leagues/nhl.m3u'),
    ('UFC MMA', '/leagues/ufc-mma.m3u'),
    ('F1 Racing', '/leagues/f1-racing.m3u'),
    ('College', '/leagues/college-sports.m3u'),
    ('Other Football', '/leagues/other-football.m3u'),
    # LG Channels
    ('LG US', 'https://www.apsattv.com/uslg.m3u'),
    ('LG UK', 'https://www.apsattv.com/gblg.m3u'),
    ('LG France', 'https://www.apsattv.com/frlg.m3u'),
    ('LG Germany', 'https://www.apsattv.com/delg.m3u'),
    ('LG Spain', 'https://www.apsattv.com/eslg.m3u'),
    ('LG Italy', 'https://www.apsattv.com/itlg.m3u'),
    ('LG Brazil', 'https://www.apsattv.com/brlg.m3u'),
    ('LG India', 'https://www.apsattv.com/inlg.m3u'),
    # Samsung/Pluto
    ('Samsung US', '/filtered/iptv-streams-samsung-tv-us-samsung.m3u'),
    ('Samsung UK', '/filtered/iptv-streams-samsung-tv-uk-samsung.m3u'),
    ('Pluto US', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_pluto.m3u'),
    # Other FAST
    ('Vizio', 'https://www.apsattv.com/vizio.m3u'),
    ('Xumo', 'https://www.apsattv.com/xumo.m3u'),
    ('Tubi', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u'),
    ('Roku', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u'),
    # Filtered
    ('World Verified', '/filtered/world-iptv-verified-all.m3u'),
    ('Free-TV', '/filtered/free-tv-all.m3u'),
    ('IPTV4ON', '/filtered/iptv4on-all.m3u'),
    ('FAST IPTV Combined', '/filtered/fast-iptv-world-cup-f-combined.m3u'),
    ('FAST IPTV Direct', '/filtered/fast-iptv-content-f-direct.m3u'),
    # IPTV-org
    ('IPTV-org Sports', 'https://iptv-org.github.io/iptv/categories/sports.m3u'),
    ('IPTV-org UK', 'https://iptv-org.github.io/iptv/countries/uk.m3u'),
    ('IPTV-org US', 'https://iptv-org.github.io/iptv/countries/us.m3u'),
    ('IPTV-org France', 'https://iptv-org.github.io/iptv/countries/fr.m3u'),
    ('IPTV-org Germany', 'https://iptv-org.github.io/iptv/countries/de.m3u'),
    ('IPTV-org Spain', 'https://iptv-org.github.io/iptv/countries/es.m3u'),
    ('IPTV-org Italy', 'https://iptv-org.github.io/iptv/countries/it.m3u'),
    ('IPTV-org Turkey', 'https://iptv-org.github.io/iptv/countries/tr.m3u'),
    ('IPTV-org Egypt', 'https://iptv-org.github.io/iptv/countries/eg.m3u'),
    ('IPTV-org Saudi', 'https://iptv-org.github.io/iptv/countries/sa.m3u'),
    ('IPTV-org Qatar', 'https://iptv-org.github.io/iptv/countries/qa.m3u'),
    ('IPTV-org UAE', 'https://iptv-org.github.io/iptv/countries/ae.m3u'),
    ('IPTV-org Brazil', 'https://iptv-org.github.io/iptv/countries/br.m3u'),
    ('IPTV-org India', 'https://iptv-org.github.io/iptv/countries/in.m3u'),
]

# ─── Sport type classifications ────────────────────────────────────────────
SPORT_TYPES = [
    {
        'id': 'american-football',
        'name': 'American Football',
        'flag': '🏈',
        'keywords': ['nfl', 'american football', 'super bowl', 'gridiron', 'touchdown',
                     'nfl channel', 'nfl network', 'nfl redzone', 'college football',
                     'ncaa football', 'flag football'],
        'exclude': ['soccer', 'fifa', 'premier league', 'la liga'],
    },
    {
        'id': 'soccer',
        'name': 'Soccer',
        'flag': '⚽',
        'keywords': ['soccer', 'fifa', 'premier league', 'la liga', 'laliga',
                     'serie a', 'bundesliga', 'ligue 1', 'mls', 'champions league',
                     'europa league', 'fa cup', 'copa libertadores', 'liga mx',
                     'brasileirao', 'j-league', 'a-league', 'world cup',
                     'football world cup', 'soccer anthems', 'bein sport',
                     'goal tv', 'goalkeeper', 'pitch', 'striker',
                     'eredivisie', 'primeira liga', 'scottish premiership',
                     'afcon', 'asian cup', 'football club', 'fc ', 'afc ',
                     'real madrid', 'barcelona', 'liverpool', 'manchester',
                     'chelsea', 'arsenal', 'tottenham', 'juventus', 'bayern',
                     'psg', 'dortmund', 'napoli', 'inter milan', 'ac milan'],
        'exclude': ['nfl', 'american football', 'basketball', 'baseball', 'hockey',
                     'ufc', 'mma', 'wwe', 'wrestling', 'nascar', 'racing'],
    },
    {
        'id': 'basketball',
        'name': 'Basketball',
        'flag': '🏀',
        'keywords': ['nba', 'basketball', 'ncaa basketball', 'hoops',
                     'lakers', 'celtics', 'bulls', 'warriors', 'nuggets',
                     'wnba', 'nba tv', 'nba channel', 'court'],
        'exclude': [],
    },
    {
        'id': 'baseball',
        'name': 'Baseball',
        'flag': '⚾',
        'keywords': ['mlb', 'baseball', 'world series', 'mlb network',
                     'yankees', 'red sox', 'dodgers', 'astros', 'pitcher',
                     'softball', 'home run', 'batting'],
        'exclude': [],
    },
    {
        'id': 'hockey',
        'name': 'Hockey',
        'flag': '🏒',
        'keywords': ['nhl', 'hockey', 'ice hockey', 'nhl network',
                     'stanley cup', 'puck', 'goalie'],
        'exclude': [],
    },
    {
        'id': 'combat',
        'name': 'Combat & Fighting',
        'flag': '🥊',
        'keywords': ['ufc', 'mma', 'mixed martial arts', 'ultimate fighting',
                     'wwe', 'wrestling', 'raw', 'smackdown', 'wrestlemania',
                     'boxing', 'fight night', 'combat', 'judo', 'karate',
                     'taekwondo', 'cage', 'knockout', 'punch', 'kickbox'],
        'exclude': [],
    },
    {
        'id': 'racing',
        'name': 'Racing & Motorsport',
        'flag': '🏎️',
        'keywords': ['formula 1', 'f1 ', 'f1.', 'formula one', 'motogp',
                     'moto gp', 'nascar', 'indycar', 'racing', 'motor racing',
                     'grand prix', 'wrc', 'world rally', 'rallycross',
                     'ferrari', 'mercedes amg', 'red bull racing', 'speedway',
                     'drag racing', 'auto racing', 'motorsport'],
        'exclude': [],
    },
    {
        'id': 'college',
        'name': 'College Sports',
        'flag': '🎓',
        'keywords': ['ncaa', 'college football', 'college basketball',
                     'college sports', 'ncaa championships', 'march madness',
                     'college world series', 'college baseball', 'college hockey',
                     'university sports'],
        'exclude': [],
    },
    {
        'id': 'extreme-outdoor',
        'name': 'Extreme & Outdoor',
        'flag': '🧗',
        'keywords': ['extreme sport', 'action sport', 'outdoor', 'adventure',
                     'skiing', 'snowboard', 'surfing', 'skateboard', 'bmx',
                     'climbing', 'hiking', 'mountain', 'fishing', 'hunting',
                     ' XTreme', 'xtreme outdoor', 'red bull'],
        'exclude': [],
    },
    {
        'id': 'general-sports',
        'name': 'General Sports (All Sports)',
        'flag': '🏆',
        'keywords': ['sport', 'espn', 'fox sport', 'nbc sport', 'cbs sport',
                     'sky sport', 'super sport', 'tnt sport', 'sport network',
                     'sports tv', 'sport tv', 'sports channel', 'fubo sport',
                     'stadium', 'bein sport', 'sports now', 'sports live',
                     'sport 1', 'sport 2', 'sport 3', 'sport 4', 'sport 5',
                     'olympic', 'olympics', 'sports news', 'sports highlights',
                     'action sports', 'sports anthems'],
        'exclude': ['movie', 'cinema', 'film', 'music', 'news channel',
                     'weather', 'fireplace', 'cooking', 'religion'],
    },
]


def classify_sport(name, group):
    """Classify channel by sport type. Returns sport_id or None."""
    text = f'{name} {group}'.lower()
    for sport in SPORT_TYPES:
        excluded = False
        for ex in sport.get('exclude', []):
            if ex in text:
                excluded = True
                break
        if excluded:
            continue
        for kw in sport['keywords']:
            if kw in text:
                return sport['id']
    return None


def is_sports_related(name, group):
    """Check if channel is sports-related at all."""
    text = f'{name} {group}'.lower()
    sports_indicators = [
        'sport', 'football', 'soccer', 'futbol', 'nba', 'nfl', 'mlb', 'nhl',
        'ufc', 'mma', 'wwe', 'racing', 'f1', 'motogp', 'nascar',
        'espn', 'bein', 'fubo', 'stadium', 'olympic', 'ncaa',
        'fifa', 'world cup', 'premier league', 'la liga', 'serie a',
        'bundesliga', 'ligue 1', 'champions league', 'europa league',
        'goal', 'arena', 'combat', 'fight', 'boxing', 'wrestling',
        'baseball', 'basketball', 'hockey', 'tennis', 'golf', 'cricket',
        'rugby', 'volleyball', 'handball', 'extreme', 'outdoor',
    ]
    for ind in sports_indicators:
        if ind in text:
            return True
    return False


def main():
    print('🏆 FreeStream TV — Comprehensive Sports Analyzer')
    print(f'   Scanning {len(ALL_SOURCES)} sources...')
    print(f'   Timeout: {TIMEOUT}s | Workers: {MAX_WORKERS}')
    print()

    # Gather all channels
    sport_channels = {s['id']: [] for s in SPORT_TYPES}
    seen_urls = set()
    seen_names = set()
    total_sports_found = 0

    for source_name, source_url in ALL_SOURCES:
        print(f'📥 {source_name}', end=' ')
        try:
            content = fetch_source(source_url)
            channels = parse_m3u(content)
            classified = 0
            for ch in channels:
                if ch['url'] in seen_urls:
                    continue
                name_key = ch['name'].lower().strip()[:60]
                if name_key in seen_names:
                    continue

                if not is_sports_related(ch['name'], ch['group']):
                    continue

                sport_id = classify_sport(ch['name'], ch['group'])
                if sport_id:
                    seen_urls.add(ch['url'])
                    seen_names.add(name_key)
                    sport_channels[sport_id].append({**ch, 'source': source_name})
                    classified += 1
                    total_sports_found += 1
            print(f'→ {len(channels)} parsed, {classified} sports')
        except Exception as e:
            print(f'→ ❌ {e}')

    print(f'\n📊 Sports channels found (before testing):')
    for s in SPORT_TYPES:
        print(f'   {s["flag"]} {s["name"]}: {len(sport_channels[s["id"]])}')

    # Test channels per sport type
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'sports')
    os.makedirs(output_dir, exist_ok=True)

    summary = []
    all_working = []

    for sport in SPORT_TYPES:
        candidates = sport_channels[sport['id']]
        if not candidates:
            print(f'\n⚠️  {sport["flag"]} {sport["name"]}: no candidates')
            summary.append({'id': sport['id'], 'name': sport['name'], 'flag': sport['flag'], 'found': 0, 'working': 0})
            continue

        test_limit = min(len(candidates), 100)
        candidates_to_test = candidates[:test_limit]

        print(f'\n🔍 Testing {sport["flag"]} {sport["name"]}: {len(candidates_to_test)} candidates')

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
                if done % 20 == 0:
                    print(f'   Progress: {done}/{len(candidates_to_test)}')

        working = []
        for idx, ch in enumerate(candidates_to_test):
            if idx in results and results[idx][0]:
                working.append(ch)
                if len(working) >= 50:
                    break

        print(f'   ✅ {len(working)} working')

        if working:
            output_file = f'{sport["id"]}.m3u'
            output_path = os.path.join(output_dir, output_file)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(f'#EXTM3U\n# {sport["name"]} — {len(working)} verified channels\n')
                seen = set()
                for ch in working:
                    if ch['url'] not in seen:
                        f.write(f'{ch["extinf"]}\n')
                        f.write(f'{ch["url"]}\n')
                        seen.add(ch['url'])
            print(f'   💾 Saved: public/sports/{output_file}')
            all_working.extend(working)

        summary.append({
            'id': sport['id'],
            'name': sport['name'],
            'flag': sport['flag'],
            'found': len(candidates),
            'working': len(working),
        })

    # Save combined "All Sports" file
    combined_path = os.path.join(output_dir, 'all-sports.m3u')
    seen = set()
    with open(combined_path, 'w', encoding='utf-8') as f:
        f.write(f'#EXTM3U\n# All Sports — {len(all_working)} verified channels\n')
        for ch in all_working:
            if ch['url'] not in seen:
                f.write(f'{ch["extinf"]}\n')
                f.write(f'{ch["url"]}\n')
                seen.add(ch['url'])
    print(f'\n💾 Saved combined: public/sports/all-sports.m3u ({len(all_working)} channels)')

    # Final summary
    print(f'\n{"=" * 70}')
    print('🏆 COMPREHENSIVE SPORTS ANALYSIS COMPLETE')
    print(f'{"=" * 70}')
    print(f'{"Sport Type":<30} {"Found":<10} {"Working":<10}')
    print('-' * 70)
    total_working = 0
    for s in summary:
        print(f'{s["flag"]} {s["name"]:<27} {s["found"]:<10} {s["working"]:<10}')
        total_working += s['working']
    print('-' * 70)
    print(f'{"TOTAL":<30} {total_sports_found:<10} {total_working:<10}')

    summary_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sports-analysis.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f'\nSummary: {summary_path}')


if __name__ == '__main__':
    main()
