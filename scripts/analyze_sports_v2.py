#!/usr/bin/env python3
"""
Comprehensive Sports Analyzer v2 — wider keywords, more sources, higher limits.

Key improvements over v1:
1. Much wider keyword lists (100+ keywords per sport)
2. Relaxed is_sports_related check (any channel with 'sport' in group title)
3. Higher test limits (200 per sport, 100 working cap)
4. More sources (IPTV-org categories + more countries)
5. Better dedup (by URL only, not name — allows same name from different sources)
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
    # Curated + Leagues + Sports
    ('Sports curated', '/curated/sports.m3u'),
    ('Sports Football', '/curated/sports-football.m3u'),
    ('Sports Soccer', '/curated/sports-soccer.m3u'),
    ('Sports Combat', '/curated/sports-combat.m3u'),
    ('Sports Racing', '/curated/sports-racing.m3u'),
    ('Sports College', '/curated/sports-college.m3u'),
    ('Sports General', '/curated/sports-general-sports.m3u'),
    ('Leagues PL', '/leagues/premier-league.m3u'),
    ('Leagues LaLiga', '/leagues/la-liga.m3u'),
    ('Leagues SerieA', '/leagues/serie-a.m3u'),
    ('Leagues CL', '/leagues/champions-league.m3u'),
    ('Leagues EL', '/leagues/europa-league.m3u'),
    ('Leagues WC', '/leagues/world-cup-2026.m3u'),
    ('Leagues NFL', '/leagues/nfl.m3u'),
    ('Leagues NBA', '/leagues/nba.m3u'),
    ('Leagues MLB', '/leagues/mlb.m3u'),
    ('Leagues NHL', '/leagues/nhl.m3u'),
    ('Leagues UFC', '/leagues/ufc-mma.m3u'),
    ('Leagues F1', '/leagues/f1-racing.m3u'),
    ('Leagues College', '/leagues/college-sports.m3u'),
    ('Leagues Other Football', '/leagues/other-football.m3u'),
    # LG Channels (all 32 countries)
    ('LG US', 'https://www.apsattv.com/uslg.m3u'),
    ('LG UK', 'https://www.apsattv.com/gblg.m3u'),
    ('LG France', 'https://www.apsattv.com/frlg.m3u'),
    ('LG Germany', 'https://www.apsattv.com/delg.m3u'),
    ('LG Spain', 'https://www.apsattv.com/eslg.m3u'),
    ('LG Italy', 'https://www.apsattv.com/itlg.m3u'),
    ('LG Brazil', 'https://www.apsattv.com/brlg.m3u'),
    ('LG Mexico', 'https://www.apsattv.com/mxlg.m3u'),
    ('LG India', 'https://www.apsattv.com/inlg.m3u'),
    ('LG Japan', 'https://www.apsattv.com/jplg.m3u'),
    ('LG Korea', 'https://www.apsattv.com/krlg.m3u'),
    ('LG UAE', 'https://www.apsattv.com/aelg.m3u'),
    ('LG Argentina', 'https://www.apsattv.com/arlg.m3u'),
    ('LG Chile', 'https://www.apsattv.com/cllg.m3u'),
    ('LG Colombia', 'https://www.apsattv.com/colg.m3u'),
    ('LG Netherlands', 'https://www.apsattv.com/nllg.m3u'),
    ('LG Sweden', 'https://www.apsattv.com/selg.m3u'),
    ('LG Norway', 'https://www.apsattv.com/nolg.m3u'),
    ('LG Denmark', 'https://www.apsattv.com/dklg.m3u'),
    ('LG Finland', 'https://www.apsattv.com/filg.m3u'),
    ('LG Poland', 'https://www.apsattv.com/pllg.m3u'),
    ('LG Australia', 'https://www.apsattv.com/aulg.m3u'),
    ('LG Canada', 'https://www.apsattv.com/calg.m3u'),
    # Samsung/Pluto
    ('Samsung US', '/filtered/iptv-streams-samsung-tv-us-samsung.m3u'),
    ('Samsung UK', '/filtered/iptv-streams-samsung-tv-uk-samsung.m3u'),
    ('Pluto US', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_pluto.m3u'),
    ('Pluto UK', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk_pluto.m3u'),
    ('Pluto Germany', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de_pluto.m3u'),
    ('Pluto Spain', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es_pluto.m3u'),
    ('Pluto France', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr_pluto.m3u'),
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
    # IPTV-org categories
    ('IPTV-org Sports', 'https://iptv-org.github.io/iptv/categories/sports.m3u'),
    # IPTV-org countries (more countries)
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
    ('IPTV-org Russia', 'https://iptv-org.github.io/iptv/countries/ru.m3u'),
    ('IPTV-org Argentina', 'https://iptv-org.github.io/iptv/countries/ar.m3u'),
    ('IPTV-org Mexico', 'https://iptv-org.github.io/iptv/countries/mx.m3u'),
    ('IPTV-org Canada', 'https://iptv-org.github.io/iptv/countries/ca.m3u'),
    ('IPTV-org Australia', 'https://iptv-org.github.io/iptv/countries/au.m3u'),
    ('IPTV-org Japan', 'https://iptv-org.github.io/iptv/countries/jp.m3u'),
    ('IPTV-org Korea', 'https://iptv-org.github.io/iptv/countries/kr.m3u'),
    ('IPTV-org Netherlands', 'https://iptv-org.github.io/iptv/countries/nl.m3u'),
    ('IPTV-org Sweden', 'https://iptv-org.github.io/iptv/countries/se.m3u'),
    ('IPTV-org Poland', 'https://iptv-org.github.io/iptv/countries/pl.m3u'),
    ('IPTV-org Portugal', 'https://iptv-org.github.io/iptv/countries/pt.m3u'),
    ('IPTV-org Greece', 'https://iptv-org.github.io/iptv/countries/gr.m3u'),
    ('IPTV-org Czech', 'https://iptv-org.github.io/iptv/countries/cz.m3u'),
    # Countries aggregated
    ('Countries Italy', '/countries/it.m3u'),
    ('Countries Indonesia', '/countries/id.m3u'),
    ('Countries US', '/countries/us.m3u'),
    ('Countries Spain', '/countries/es.m3u'),
    ('Countries Greece', '/countries/gr.m3u'),
    ('Countries Czech', '/countries/cz.m3u'),
    ('Countries Russia', '/countries/ru.m3u'),
    ('Countries India', '/countries/in.m3u'),
    ('Countries France', '/countries/fr.m3u'),
    ('Countries UK', '/countries/gb.m3u'),
    ('Countries Germany', '/countries/de.m3u'),
]

# ─── Sport type classifications (MUCH wider keywords) ─────────────────────
SPORT_TYPES = [
    {
        'id': 'american-football',
        'name': 'American Football',
        'flag': '🏈',
        'keywords': ['nfl', 'american football', 'super bowl', 'gridiron', 'touchdown',
                     'nfl channel', 'nfl network', 'nfl redzone', 'college football',
                     'ncaa football', 'flag football', 'redzone', 'gridiron',
                     'cowboys', 'packers', 'chiefs', 'eagles', '49ers', 'ravens',
                     'bills', 'bengals', 'steelers', 'rams'],
        'exclude': ['soccer', 'fifa'],
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
                     'psg', 'dortmund', 'napoli', 'inter milan', 'ac milan',
                     'atletico', 'sevilla', 'valencia', 'roma', 'lazio',
                     'atletico madrid', 'tottenham', 'newcastle', 'aston villa',
                     'brighton', 'leicester', 'everton', 'west ham',
                     'tigi sport', 'football', 'futbol', 'futebol',
                     'copa america', 'copa do', 'liga', 'cup ',
                     'super cup', 'supercup', 'playoff', 'division',
                     'rangers', 'celtic', 'ajax', 'psv', 'feyenoord',
                     'porto', 'benfica', 'sporting', 'galatasaray',
                     'fenerbahce', 'besiktas', 'olympiacos', 'panathinaikos',
                     'shakhtar', 'dynamo', 'red star', 'partizan'],
        'exclude': ['nfl', 'american football', 'basketball', 'baseball', 'hockey',
                     'ufc', 'mma', 'wwe', 'wrestling', 'nascar', 'racing',
                     'movie', 'cinema', 'film'],
    },
    {
        'id': 'basketball',
        'name': 'Basketball',
        'flag': '🏀',
        'keywords': ['nba', 'basketball', 'ncaa basketball', 'hoops',
                     'lakers', 'celtics', 'bulls', 'warriors', 'nuggets',
                     'wnba', 'nba tv', 'nba channel', 'court', 'dunk',
                     'knicks', 'heat', 'bucks', 'suns', 'mavericks',
                     'clippers', '76ers', 'trail blazers', 'kings',
                     'pelicans', 'thunder', 'timberwolves', 'grizzlies',
                     'spurs', 'rockets', 'magic', 'hornets', 'pacers',
                     'hawks', 'raptors', 'pistons', 'cavaliers', 'nets'],
        'exclude': [],
    },
    {
        'id': 'baseball',
        'name': 'Baseball',
        'flag': '⚾',
        'keywords': ['mlb', 'baseball', 'world series', 'mlb network',
                     'yankees', 'red sox', 'dodgers', 'astros', 'pitcher',
                     'softball', 'home run', 'batting', 'diamond',
                     'cubs', 'giants', 'mets', 'cardinals', 'braves',
                     'phillies', 'padres', 'rays', 'twins', 'white sox',
                     'indians', 'royals', 'tigers', 'mariners', 'orioles',
                     'pirates', 'reds', 'athletics', 'rangers', 'blue jays',
                     'nationals', 'brewers', 'rockies', 'marlins'],
        'exclude': [],
    },
    {
        'id': 'hockey',
        'name': 'Hockey',
        'flag': '🏒',
        'keywords': ['nhl', 'hockey', 'ice hockey', 'nhl network',
                     'stanley cup', 'puck', 'goalie', 'rink',
                     'rangers', 'bruins', 'maple leafs', 'canadiens',
                     'blackhawks', 'red wings', 'flyers', 'penguins',
                     'capitals', 'lightning', 'panthers', 'sabres',
                     'senators', 'flames', 'oilers', 'canucks', 'jets',
                     'wild', 'avalanche', 'stars', 'predators', 'sharks',
                     'ducks', 'kings', 'blue jackets', 'islanders', 'devils',
                     'coyotes', 'kraken'],
        'exclude': [],
    },
    {
        'id': 'combat',
        'name': 'Combat & Fighting',
        'flag': '🥊',
        'keywords': ['ufc', 'mma', 'mixed martial arts', 'ultimate fighting',
                     'wwe', 'wrestling', 'raw', 'smackdown', 'wrestlemania',
                     'boxing', 'fight night', 'combat', 'judo', 'karate',
                     'taekwondo', 'cage', 'knockout', 'punch', 'kickbox',
                     'bellator', 'one championship', 'pfl', 'bare knuckle',
                     'sumo', 'muay thai', 'jiu jitsu', 'grappling',
                     'ring', 'fighter', 'champion', 'title fight'],
        'exclude': [],
    },
    {
        'id': 'racing',
        'name': 'Racing & Motorsport',
        'flag': '🏎️',
        'keywords': ['formula 1', 'f1', 'formula one', 'motogp', 'moto gp',
                     'nascar', 'indycar', 'racing', 'motor racing',
                     'grand prix', 'wrc', 'world rally', 'rallycross',
                     'ferrari', 'mercedes amg', 'red bull racing', 'speedway',
                     'drag racing', 'auto racing', 'motorsport', 'motor sport',
                     'moto2', 'moto3', 'world superbike', 'wsbk', 'sbk',
                     'touring car', 'dtm', 'supercars', 'v8 supercars',
                     'le mans', 'endurance racing', 'rally', 'karting',
                     'horse racing', 'greyhound'],
        'exclude': [],
    },
    {
        'id': 'tennis-golf',
        'name': 'Tennis & Golf',
        'flag': '🎾',
        'keywords': ['tennis', 'wimbledon', 'us open', 'french open',
                     'australian open', 'atp', 'wta', 'grand slam',
                     'golf', 'pga', 'lpga', 'masters', 'open championship',
                     'ryder cup', 'fedex cup', 'pga tour', 'tiger woods',
                     'tee time', 'fairway', 'putt', 'bunker',
                     'court', 'serve', 'volley', 'forehand', 'backhand'],
        'exclude': ['basketball court', 'food court'],
    },
    {
        'id': 'college',
        'name': 'College Sports',
        'flag': '🎓',
        'keywords': ['ncaa', 'college football', 'college basketball',
                     'college sports', 'ncaa championships', 'march madness',
                     'college world series', 'college baseball', 'college hockey',
                     'university sports', 'campus', 'student athlete',
                     'sec ', 'big ten', 'big 12', 'acc ', 'pac 12',
                     'fighting illini', 'wildcats', 'bulldogs', 'sooners'],
        'exclude': [],
    },
    {
        'id': 'extreme-outdoor',
        'name': 'Extreme & Outdoor',
        'flag': '🧗',
        'keywords': ['extreme sport', 'action sport', 'outdoor', 'adventure',
                     'skiing', 'snowboard', 'surfing', 'skateboard', 'bmx',
                     'climbing', 'hiking', 'mountain', 'fishing', 'hunting',
                     'xtreme', 'red bull', 'dive', 'parachute', 'skydiv',
                     'wakeboard', 'kiteboard', 'windsurf', 'sail',
                     'bike', 'cycling', 'bicycle', 'mtb', 'triathlon',
                     'fitness', 'workout', 'training', 'gym', 'bodybuild',
                     'nature', 'wildlife', 'outdoor channel', 'pursuit'],
        'exclude': ['movie', 'cinema', 'film'],
    },
    {
        'id': 'cricket-rugby',
        'name': 'Cricket & Rugby',
        'flag': '🏏',
        'keywords': ['cricket', 'ipl', 'bbl', 'test match', 't20',
                     'icc', 'world cup cricket', ' ashes',
                     'rugby', 'six nations', 'rugby world cup',
                     'super rugby', 'premiership rugby', 'top 14',
                     'rugby league', 'rugby union', 'nrl'],
        'exclude': [],
    },
    {
        'id': 'general-sports',
        'name': 'General Sports',
        'flag': '🏆',
        'keywords': ['sport', 'espn', 'fox sport', 'nbc sport', 'cbs sport',
                     'sky sport', 'super sport', 'tnt sport', 'sport network',
                     'sports tv', 'sport tv', 'sports channel', 'fubo sport',
                     'stadium', 'bein sport', 'sports now', 'sports live',
                     'sport 1', 'sport 2', 'sport 3', 'sport 4', 'sport 5',
                     'olympic', 'olympics', 'sports news', 'sports highlights',
                     'action sports', 'sports anthems', 'viasport', 'canal+ sport',
                     'setanta', 'premier sport', 'bt sport', 'eleven sport',
                     'arena sport', 'match', 'game', 'tournament',
                     'championship', 'league', 'athletic', 'training',
                     'live sport', 'pro tv', 'cosmosport', 'sportsman',
                     'outdoor channel', 'pursuit channel', 'world of sport'],
        'exclude': ['movie', 'cinema', 'film', 'music channel', 'cooking channel',
                     'religion', 'religious', 'weather channel'],
    },
]


def classify_sport(name, group):
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
    """Much wider check — any channel that mentions sport in name or group."""
    text = f'{name} {group}'.lower()
    # If the group title contains 'sport' it's almost certainly a sports channel
    if 'sport' in (group or '').lower():
        return True
    # Check name for any sports keyword
    sports_words = [
        'sport', 'football', 'soccer', 'futbol', 'futebol', 'nba', 'nfl', 'mlb', 'nhl',
        'ufc', 'mma', 'wwe', 'wrestling', 'racing', 'f1', 'motogp', 'nascar',
        'espn', 'bein', 'fubo', 'stadium', 'olympic', 'ncaa', 'arena',
        'fifa', 'world cup', 'premier league', 'la liga', 'serie a',
        'bundesliga', 'ligue 1', 'champions league', 'europa league',
        'goal', 'combat', 'fight', 'boxing', 'baseball', 'basketball',
        'hockey', 'tennis', 'golf', 'cricket', 'rugby', 'volleyball',
        'handball', 'extreme', 'outdoor', 'fishing', 'hunting',
        'match', 'game', 'league', 'athletic', 'championship',
        'tournament', 'skiing', 'snowboard', 'surf', 'skate',
        'cycling', 'bike', 'fitness', 'gym', 'dive', 'sail',
    ]
    for word in sports_words:
        if word in text:
            return True
    return False


def main():
    print('🏆 FreeStream TV — Comprehensive Sports Analyzer v2')
    print(f'   Scanning {len(ALL_SOURCES)} sources...')
    print(f'   Timeout: {TIMEOUT}s | Workers: {MAX_WORKERS}')
    print()

    sport_channels = {s['id']: [] for s in SPORT_TYPES}
    seen_urls = set()
    total_found = 0

    for source_name, source_url in ALL_SOURCES:
        print(f'📥 {source_name}', end=' ')
        try:
            content = fetch_source(source_url)
            channels = parse_m3u(content)
            classified = 0
            for ch in channels:
                if ch['url'] in seen_urls:
                    continue
                if not is_sports_related(ch['name'], ch['group']):
                    continue
                sport_id = classify_sport(ch['name'], ch['group'])
                if sport_id:
                    seen_urls.add(ch['url'])
                    sport_channels[sport_id].append({**ch, 'source': source_name})
                    classified += 1
                    total_found += 1
            print(f'→ {len(channels)} parsed, {classified} sports')
        except Exception as e:
            print(f'→ ❌ {e}')

    print(f'\n📊 Sports channels found (before testing):')
    for s in SPORT_TYPES:
        print(f'   {s["flag"]} {s["name"]}: {len(sport_channels[s["id"]])}')

    # Test channels — 200 per sport, 100 working cap
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'sports')
    os.makedirs(output_dir, exist_ok=True)

    summary = []
    all_working = []

    for sport in SPORT_TYPES:
        candidates = sport_channels[sport['id']]
        if not candidates:
            summary.append({'id': sport['id'], 'name': sport['name'], 'flag': sport['flag'], 'found': 0, 'working': 0})
            continue

        test_limit = min(len(candidates), 200)  # Increased from 100 to 200
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
                if done % 25 == 0:
                    print(f'   Progress: {done}/{len(candidates_to_test)}')

        working = []
        for idx, ch in enumerate(candidates_to_test):
            if idx in results and results[idx][0]:
                working.append(ch)
                if len(working) >= 100:  # Increased from 50 to 100
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
            'id': sport['id'], 'name': sport['name'], 'flag': sport['flag'],
            'found': len(candidates), 'working': len(working),
        })

    # Save combined
    combined_path = os.path.join(output_dir, 'all-sports.m3u')
    seen = set()
    with open(combined_path, 'w', encoding='utf-8') as f:
        f.write(f'#EXTM3U\n# All Sports — {len(all_working)} verified channels\n')
        for ch in all_working:
            if ch['url'] not in seen:
                f.write(f'{ch["extinf"]}\n')
                f.write(f'{ch["url"]}\n')
                seen.add(ch['url'])
    print(f'\n💾 Combined: public/sports/all-sports.m3u ({len(all_working)} channels)')

    print(f'\n{"=" * 70}')
    print('🏆 SPORTS ANALYSIS v2 COMPLETE')
    print(f'{"=" * 70}')
    print(f'{"Sport Type":<30} {"Found":<10} {"Working":<10}')
    print('-' * 70)
    total_working = 0
    for s in summary:
        print(f'{s["flag"]} {s["name"]:<27} {s["found"]:<10} {s["working"]:<10}')
        total_working += s['working']
    print('-' * 70)
    print(f'{"TOTAL":<30} {total_found:<10} {total_working:<10}')

    summary_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sports-analysis.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)


if __name__ == '__main__':
    main()
