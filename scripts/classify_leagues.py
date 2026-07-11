#!/usr/bin/env python3
"""
League classifier — finds channels that stream specific football leagues/championships.

Analyzes all sports channels and classifies them by the leagues they cover:
- Premier League (England)
- La Liga (Spain)
- Serie A (Italy)
- Bundesliga (Germany)
- Ligue 1 (France)
- Champions League
- Europa League
- World Cup 2026
- NFL (American Football)
- NBA (Basketball)
- MLB (Baseball)
- NHL (Hockey)
- UFC/MMA (Combat)
- Formula 1 / MotoGP (Racing)

Saves per-league M3U files to public/leagues/<league>.m3u
"""

import os
import re
import sys
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curate_best_100 import check_url, parse_m3u, fetch_source, HEADERS, TIMEOUT, MAX_WORKERS

# ─── League definitions ─────────────────────────────────────────────────────
LEAGUES = [
    {
        'id': 'premier-league',
        'name': 'Premier League',
        'flag': '🦁',
        'keywords': ['premier league', 'epl', 'english premier', 'barclays',
                     'manchester united', 'man city', 'manchester city', 'liverpool',
                     'chelsea', 'arsenal', 'tottenham', 'spurs', 'newcastle',
                     'everton', 'west ham', 'aston villa', 'brighton',
                     'english football', 'fa cup', 'efl cup', 'carabao'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Premier_League_Logo.svg/512px-Premier_League_Logo.svg.png',
    },
    {
        'id': 'la-liga',
        'name': 'La Liga',
        'flag': '🇪🇸',
        'keywords': ['la liga', 'laliga', 'la liga ea sports', 'spanish league',
                     'real madrid', 'barcelona', 'fc barcelona', 'atletico madrid',
                     'atletico', 'sevilla', 'valencia', 'villarreal', 'real betis',
                     'spanish football', 'copa del rey', 'supercopa'],
        'logo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/LaLiga_logo_2023.svg/512px-LaLiga_logo_2023.svg.png',
    },
    {
        'id': 'serie-a',
        'name': 'Serie A',
        'flag': '🇮🇹',
        'keywords': ['serie a', 'italian league', 'italian football',
                     'juventus', 'inter milan', 'inter ', 'ac milan', 'milan ',
                     'napoli', 'roma', 'lazio', 'atalanta', 'fiorentina',
                     'coppa italia', 'supercoppa'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0d/Serie_A_logo_2022.svg/512px-Serie_A_logo_2022.svg.png',
    },
    {
        'id': 'bundesliga',
        'name': 'Bundesliga',
        'flag': '🇩🇪',
        'keywords': ['bundesliga', 'german league', 'german football',
                     'bayern munich', 'bayern ', 'borussia dortmund', 'dortmund',
                     'bvb', 'rb leipzig', 'leverkusen', 'bayern leverkusen',
                     'schalke', 'werder bremen', 'eintracht frankfurt',
                     'dfb-pokal', 'dfb pokal'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d7/Bundesliga_logo_%282017%29.svg/512px-Bundesliga_logo_%282017%29.svg.png',
    },
    {
        'id': 'ligue-1',
        'name': 'Ligue 1',
        'flag': '🇫🇷',
        'keywords': ['ligue 1', 'ligue1', 'french league', 'french football',
                     'psg', 'paris saint-germain', 'paris saint germain',
                     'marseille', 'lyon', 'monaco', 'lille', 'nice',
                     'coupe de france', 'trophee des champions'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/47/Ligue_1_Uber_Eats.svg/512px-Ligue_1_Uber_Eats.svg.png',
    },
    {
        'id': 'champions-league',
        'name': 'Champions League',
        'flag': '🏆',
        'keywords': ['champions league', 'ucl', 'uefa champions',
                     'champions league ', 'ucl ', 'european cup',
                     'real madrid tv', 'uefa'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League.svg/512px-UEFA_Champions_League.svg.png',
    },
    {
        'id': 'europa-league',
        'name': 'Europa League',
        'flag': '🥈',
        'keywords': ['europa league', 'uel', 'uefa europa', 'uefa cup'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/UEFA_Europa_League.svg/512px-UEFA_Europa_League.svg.png',
    },
    {
        'id': 'world-cup-2026',
        'name': 'World Cup 2026',
        'flag': '🏆',
        'keywords': ['world cup', 'fifa world cup', 'world cup 2026',
                     'wc 2026', 'fifa+', 'fifa +', 'fifa 2026',
                     'football world cup', 'soccer world cup', 'copa america',
                     'world cup qualifier', 'wc qualifier'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0b/2026_FIFA_World_Cup.svg/512px-2026_FIFA_World_Cup.svg.png',
    },
    {
        'id': 'nfl',
        'name': 'NFL (American Football)',
        'flag': '🏈',
        'keywords': ['nfl', 'national football league', 'american football',
                     'super bowl', 'touchdown', 'gridiron', 'nfl channel',
                     'nfl network', 'nfl redzone'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/NFL_logo.svg/512px-NFL_logo.svg.png',
    },
    {
        'id': 'nba',
        'name': 'NBA (Basketball)',
        'flag': '🏀',
        'keywords': ['nba', 'national basketball', 'basketball nba',
                     'lakers', 'celtics', 'bulls', 'warriors', 'nuggets',
                     'nba tv', 'nba channel', 'nba league pass'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/Nba_logo.svg/512px-Nba_logo.svg.png',
    },
    {
        'id': 'mlb',
        'name': 'MLB (Baseball)',
        'flag': '⚾',
        'keywords': ['mlb', 'major league baseball', 'baseball mlb',
                     'world series', 'mlb network', 'mlb channel',
                     'yankees', 'red sox', 'dodgers', 'astros'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a6/Major_League_Baseball_logo.svg/512px-Major_League_Baseball_logo.svg.png',
    },
    {
        'id': 'nhl',
        'name': 'NHL (Hockey)',
        'flag': '🏒',
        'keywords': ['nhl', 'national hockey league', 'ice hockey nhl',
                     'nhl network', 'stanley cup', 'nhl channel'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0d/NHL_Logo.svg/512px-NHL_Logo.svg.png',
    },
    {
        'id': 'ufc-mma',
        'name': 'UFC & MMA',
        'flag': '🥊',
        'keywords': ['ufc', 'mma', 'mixed martial arts', 'ultimate fighting',
                     'ufc fight', 'ufc channel', 'mma fighting', 'cage fighting',
                     'wwe', 'wrestling', 'raw ', 'smackdown', 'wrestlemania',
                     'boxing', 'knockout', 'fight night'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8d/UFC_Logo_2022.svg/512px-UFC_Logo_2022.svg.png',
    },
    {
        'id': 'f1-racing',
        'name': 'F1 & Motorsport',
        'flag': '🏎️',
        'keywords': ['formula 1', 'f1 ', 'f1.', 'formula one', 'motogp',
                     'moto gp', 'moto2', 'moto3', 'nascar', 'indycar',
                     'racing', 'motor racing', 'grand prix', 'gp ',
                     'wrc', 'world rally', 'rallycross', 'drag racing',
                     'speedway', 'auto racing', 'ferrari', 'mercedes amg',
                     'red bull racing'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0d/F1_Logo_2023.svg/512px-F1_Logo_2023.svg.png',
    },
    {
        'id': 'college-sports',
        'name': 'College Sports (NCAA)',
        'flag': '🎓',
        'keywords': ['ncaa', 'college football', 'college basketball',
                     'college sports', 'university sports', 'campus sports',
                     'student athlete', 'ncaa championships', 'march madness',
                     'college world series', 'college baseball', 'college hockey'],
        'logo': 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2c/NCAA_logo.svg/512px-NCAA_logo.svg.png',
    },
]

# Sources to scan for league-specific channels
SOURCES_TO_USE = [
    ('LG US', 'https://www.apsattv.com/uslg.m3u'),
    ('LG UK', 'https://www.apsattv.com/gblg.m3u'),
    ('LG France', 'https://www.apsattv.com/frlg.m3u'),
    ('LG Germany', 'https://www.apsattv.com/delg.m3u'),
    ('LG Spain', 'https://www.apsattv.com/eslg.m3u'),
    ('LG Italy', 'https://www.apsattv.com/itlg.m3u'),
    ('Samsung US', '/filtered/iptv-streams-samsung-tv-us-samsung.m3u'),
    ('World Verified', '/filtered/world-iptv-verified-all.m3u'),
    ('Free-TV', '/filtered/free-tv-all.m3u'),
    ('beIN', '/filtered/bein-verified.m3u'),
    ('IPTV4ON', '/filtered/iptv4on-all.m3u'),
    ('FAST IPTV Combined', '/filtered/fast-iptv-world-cup-f-combined.m3u'),
    ('FAST IPTV Direct', '/filtered/fast-iptv-content-f-direct.m3u'),
    ('FAST IPTV Indian', '/filtered/fast-iptv-countries-f-indian.m3u'),
    ('Sports curated', '/curated/sports.m3u'),
    ('Sports Football', '/curated/sports-football.m3u'),
    ('Sports Soccer', '/curated/sports-soccer.m3u'),
    ('Sports Combat', '/curated/sports-combat.m3u'),
    ('Sports Racing', '/curated/sports-racing.m3u'),
    ('Sports College', '/curated/sports-college.m3u'),
    ('Sports General', '/curated/sports-general-sports.m3u'),
    ('International', '/curated/international.m3u'),
    ('Tubi', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u'),
    ('Roku', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u'),
    ('Vizio', 'https://www.apsattv.com/vizio.m3u'),
    ('Xumo', 'https://www.apsattv.com/xumo.m3u'),
]


def classify_league(name, group):
    """Determine which league a channel belongs to. Returns league_id or None."""
    text = f'{name} {group}'.lower()
    for league in LEAGUES:
        for kw in league['keywords']:
            if kw in text:
                return league['id']
    return None


def main():
    print('🏆 FreeStream TV — League Classifier')
    print(f'   Classifying channels by football leagues & sports championships')
    print(f'   Timeout: {TIMEOUT}s | Workers: {MAX_WORKERS}')
    print()

    # Gather all channels and classify by league
    league_channels = {l['id']: [] for l in LEAGUES}
    seen_urls = set()

    for source_name, source_url in SOURCES_TO_USE:
        print(f'📥 {source_name}')
        try:
            content = fetch_source(source_url)
            channels = parse_m3u(content)
            classified = 0
            for ch in channels:
                if ch['url'] in seen_urls:
                    continue
                league_id = classify_league(ch['name'], ch['group'])
                if league_id:
                    seen_urls.add(ch['url'])
                    league_channels[league_id].append({**ch, 'source': source_name})
                    classified += 1
            print(f'   {len(channels)} parsed, {classified} league matches')
        except Exception as e:
            print(f'   ❌ {e}')

    print()
    print('📊 Candidates per league (before testing):')
    for l in LEAGUES:
        print(f'   {l["flag"]} {l["name"]}: {len(league_channels[l["id"]])} candidates')

    # Test channels per league
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'leagues')
    os.makedirs(output_dir, exist_ok=True)

    summary = []
    for league in LEAGUES:
        candidates = league_channels[league['id']]
        if not candidates:
            print(f'\n⚠️  {league["flag"]} {league["name"]}: no candidates — skipping')
            summary.append({'id': league['id'], 'name': league['name'], 'flag': league['flag'],
                           'logo': league.get('logo'), 'candidates': 0, 'working': 0})
            continue

        test_limit = min(len(candidates), 100)
        candidates_to_test = candidates[:test_limit]

        print(f'\n🔍 Testing {league["flag"]} {league["name"]}: {len(candidates_to_test)} candidates')

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
                if done % 15 == 0:
                    print(f'   Progress: {done}/{len(candidates_to_test)}')

        working = []
        for idx, ch in enumerate(candidates_to_test):
            if idx in results and results[idx][0]:
                working.append(ch)
                if len(working) >= 50:
                    break

        print(f'   ✅ {len(working)} working channels')

        if working:
            output_file = f'{league["id"]}.m3u'
            output_path = os.path.join(output_dir, output_file)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(f'#EXTM3U\n# {league["name"]} — {len(working)} verified channels\n')
                seen = set()
                for ch in working:
                    if ch['url'] not in seen:
                        f.write(f'{ch["extinf"]}\n')
                        f.write(f'{ch["url"]}\n')
                        seen.add(ch['url'])
            print(f'   💾 Saved: public/leagues/{output_file}')

        summary.append({
            'id': league['id'],
            'name': league['name'],
            'flag': league['flag'],
            'logo': league.get('logo'),
            'candidates': len(candidates),
            'working': len(working),
        })

    # Final summary
    print(f'\n{"=" * 70}')
    print('🏆 LEAGUE CLASSIFICATION COMPLETE')
    print(f'{"=" * 70}')
    print(f'{"League":<30} {"Candidates":<12} {"Working":<10}')
    print('-' * 70)
    total_working = 0
    for s in summary:
        print(f'{s["flag"]} {s["name"]:<27} {s["candidates"]:<12} {s["working"]:<10}')
        total_working += s['working']
    print('-' * 70)
    print(f'{"TOTAL":<30} {"":<12} {total_working:<10}')

    # Save summary
    summary_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leagues-summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f'\nSummary: {summary_path}')


if __name__ == '__main__':
    main()
