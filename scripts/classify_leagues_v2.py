#!/usr/bin/env python3
"""
Enhanced league classifier — wider analysis with better channel selection.

Improvements over v1:
1. Wider source list (includes ALL provider playlists)
2. Better keyword matching (exact team names, stricter matching)
3. Prioritizes channels with sport-related group titles
4. Deduplicates by channel name (not just URL)
5. Filters out obviously non-sports channels (movies, music, news)
"""

import os
import re
import sys
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curate_best_100 import check_url, parse_m3u, fetch_source, HEADERS, TIMEOUT, MAX_WORKERS

# ─── Enhanced league definitions ────────────────────────────────────────────
# More specific keywords, exclude common false positives
LEAGUES = [
    {
        'id': 'premier-league',
        'name': 'Premier League',
        'flag': '🦁',
        'keywords': ['premier league', 'epl', 'english premier',
                     'manchester united', 'manchester city', 'man city',
                     'liverpool fc', 'chelsea fc', 'arsenal fc', 'tottenham',
                     'spurs', 'newcastle united', 'west ham', 'aston villa',
                     'brighton', 'leicester', 'everton fc',
                     'fa cup', 'carabao cup', 'efl cup', 'community shield'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news', 'weather', 'fireplace'],
        'logo': '🦁',
    },
    {
        'id': 'la-liga',
        'name': 'La Liga',
        'flag': '🇪🇸',
        'keywords': ['la liga', 'laliga', 'la liga ea',
                     'real madrid', 'fc barcelona', 'barcelona fc',
                     'atletico madrid', 'atletico', 'sevilla fc',
                     'valencia cf', 'villarreal', 'real betis',
                     'athletic bilbao', 'real sociedad',
                     'copa del rey', 'supercopa de espana'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🇪🇸',
    },
    {
        'id': 'serie-a',
        'name': 'Serie A',
        'flag': '🇮🇹',
        'keywords': ['serie a', 'seriea', 'italian league',
                     'juventus', 'inter milan', 'inter ', 'ac milan',
                     'napoli', 'as roma', 'roma ', 'lazio',
                     'atalanta', 'fiorentina', 'torino',
                     'coppa italia', 'supercoppa'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🇮🇹',
    },
    {
        'id': 'bundesliga',
        'name': 'Bundesliga',
        'flag': '🇩🇪',
        'keywords': ['bundesliga', 'german league',
                     'bayern munich', 'bayern ',
                     'borussia dortmund', 'bvb',
                     'rb leipzig', 'leverkusen', 'bayern leverkusen',
                     'schalke', 'werder bremen', 'eintracht frankfurt',
                     'dfb-pokal'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🇩🇪',
    },
    {
        'id': 'ligue-1',
        'name': 'Ligue 1',
        'flag': '🇫🇷',
        'keywords': ['ligue 1', 'ligue1', 'french league',
                     'psg ', 'paris saint-germain', 'paris saint germain',
                     'marseille', 'lyon', 'monaco ',
                     'lille', 'nice ',
                     'coupe de france'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🇫🇷',
    },
    {
        'id': 'champions-league',
        'name': 'Champions League',
        'flag': '🏆',
        'keywords': ['champions league', 'ucl ', 'uefa champions',
                     'champions league ', 'european cup',
                     'real madrid tv', 'uefa '],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music'],
        'logo': '🏆',
    },
    {
        'id': 'europa-league',
        'name': 'Europa League',
        'flag': '🥈',
        'keywords': ['europa league', 'uel ', 'uefa europa', 'uefa cup'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music'],
        'logo': '🥈',
    },
    {
        'id': 'world-cup-2026',
        'name': 'World Cup 2026',
        'flag': '🏆',
        'keywords': ['world cup 2026', 'fifa world cup', 'fifa world cup 2026',
                     'wc 2026', 'fifa+', 'fifa +',
                     'football world cup', 'soccer world cup',
                     'copa america', 'world cup qualifier'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'replay'],
        'logo': '🏆',
    },
    {
        'id': 'nfl',
        'name': 'NFL (American Football)',
        'flag': '🏈',
        'keywords': ['nfl', 'national football league',
                     'super bowl', 'nfl channel', 'nfl network', 'nfl redzone'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🏈',
    },
    {
        'id': 'nba',
        'name': 'NBA (Basketball)',
        'flag': '🏀',
        'keywords': ['nba', 'national basketball',
                     'lakers', 'celtics', 'bulls', 'warriors', 'nuggets',
                     'nba tv', 'nba channel', 'nba league pass'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🏀',
    },
    {
        'id': 'mlb',
        'name': 'MLB (Baseball)',
        'flag': '⚾',
        'keywords': ['mlb', 'major league baseball',
                     'world series', 'mlb network', 'mlb channel',
                     'yankees', 'red sox', 'dodgers', 'astros'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '⚾',
    },
    {
        'id': 'nhl',
        'name': 'NHL (Hockey)',
        'flag': '🏒',
        'keywords': ['nhl', 'national hockey league',
                     'nhl network', 'stanley cup', 'nhl channel'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🏒',
    },
    {
        'id': 'ufc-mma',
        'name': 'UFC & MMA',
        'flag': '🥊',
        'keywords': ['ufc', 'mma', 'mixed martial arts', 'ultimate fighting',
                     'ufc fight', 'ufc channel', 'mma fighting',
                     'wwe', 'wrestling', 'raw ', 'smackdown', 'wrestlemania',
                     'boxing', 'fight night', 'combat'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🥊',
    },
    {
        'id': 'f1-racing',
        'name': 'F1 & Motorsport',
        'flag': '🏎️',
        'keywords': ['formula 1', 'f1 ', 'f1.', 'formula one', 'motogp',
                     'moto gp', 'nascar', 'indycar',
                     'motor racing', 'grand prix',
                     'wrc', 'world rally', 'rallycross',
                     'ferrari', 'mercedes amg', 'red bull racing'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🏎️',
    },
    {
        'id': 'college-sports',
        'name': 'College Sports (NCAA)',
        'flag': '🎓',
        'keywords': ['ncaa', 'college football', 'college basketball',
                     'college sports', 'ncaa championships', 'march madness',
                     'college world series', 'college baseball'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news'],
        'logo': '🎓',
    },
    {
        'id': 'other-football',
        'name': 'Other Football (Soccer)',
        'flag': '⚽',
        'keywords': ['football', 'soccer', 'futbol', 'futebol',
                     'bein sport', 'bein sports', 'super sport',
                     'fox sports', 'espn', 'sky sport',
                     'tv sport', 'sport tv', 'sports tv',
                     'goal', 'pitch', 'kickoff',
                     'eredivisie', 'primeira liga', 'scottish premiership',
                     'mls soccer', 'liga mx', 'brasileirao',
                     'j-league', 'k-league', 'a-league',
                     'afcon', 'asian cup', 'copa libertadores'],
        'exclude_keywords': ['movie', 'cinema', 'film', 'music', 'news', 'weather',
                             'fireplace', 'nfl', 'basketball', 'baseball', 'hockey',
                             'ufc', 'mma', 'wwe', 'wrestling', 'boxing', 'nascar',
                             'racing', 'motogp', 'ncaa', 'college'],
        'logo': '⚽',
    },
]

# Wider source list — include ALL playlists from all providers
SOURCES_TO_USE = [
    # Curated files
    ('Sports curated', '/curated/sports.m3u'),
    ('Sports Football', '/curated/sports-football.m3u'),
    ('Sports Soccer', '/curated/sports-soccer.m3u'),
    ('Sports Combat', '/curated/sports-combat.m3u'),
    ('Sports Racing', '/curated/sports-racing.m3u'),
    ('Sports College', '/curated/sports-college.m3u'),
    ('Sports General', '/curated/sports-general-sports.m3u'),
    ('International', '/curated/international.m3u'),
    # FAST platforms
    ('LG US', 'https://www.apsattv.com/uslg.m3u'),
    ('LG UK', 'https://www.apsattv.com/gblg.m3u'),
    ('LG France', 'https://www.apsattv.com/frlg.m3u'),
    ('LG Germany', 'https://www.apsattv.com/delg.m3u'),
    ('LG Spain', 'https://www.apsattv.com/eslg.m3u'),
    ('LG Italy', 'https://www.apsattv.com/itlg.m3u'),
    ('LG Brazil', 'https://www.apsattv.com/brlg.m3u'),
    ('LG India', 'https://www.apsattv.com/inlg.m3u'),
    ('Samsung US', '/filtered/iptv-streams-samsung-tv-us-samsung.m3u'),
    ('Samsung UK', '/filtered/iptv-streams-samsung-tv-uk-samsung.m3u'),
    ('Pluto US', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_pluto.m3u'),
    ('Vizio', 'https://www.apsattv.com/vizio.m3u'),
    ('Xumo', 'https://www.apsattv.com/xumo.m3u'),
    ('Tubi', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u'),
    ('Roku', 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u'),
    # Filtered sources
    ('World Verified', '/filtered/world-iptv-verified-all.m3u'),
    ('Free-TV', '/filtered/free-tv-all.m3u'),
    ('beIN', '/filtered/bein-verified.m3u'),
    ('IPTV4ON', '/filtered/iptv4on-all.m3u'),
    ('FAST IPTV Combined', '/filtered/fast-iptv-world-cup-f-combined.m3u'),
    ('FAST IPTV Direct', '/filtered/fast-iptv-content-f-direct.m3u'),
    ('FAST IPTV Indian', '/filtered/fast-iptv-countries-f-indian.m3u'),
    # IPTV-org sports category
    ('IPTV-org Sports', 'https://iptv-org.github.io/iptv/categories/sports.m3u'),
    # IPTV-org country playlists (top football countries)
    ('IPTV-org UK', 'https://iptv-org.github.io/iptv/countries/uk.m3u'),
    ('IPTV-org France', 'https://iptv-org.github.io/iptv/countries/fr.m3u'),
    ('IPTV-org Germany', 'https://iptv-org.github.io/iptv/countries/de.m3u'),
    ('IPTV-org Spain', 'https://iptv-org.github.io/iptv/countries/es.m3u'),
    ('IPTV-org Italy', 'https://iptv-org.github.io/iptv/countries/it.m3u'),
    ('IPTV-org Brazil', 'https://iptv-org.github.io/iptv/countries/br.m3u'),
    ('IPTV-org Turkey', 'https://iptv-org.github.io/iptv/countries/tr.m3u'),
    ('IPTV-org Egypt', 'https://iptv-org.github.io/iptv/countries/eg.m3u'),
    ('IPTV-org Saudi', 'https://iptv-org.github.io/iptv/countries/sa.m3u'),
    ('IPTV-org Qatar', 'https://iptv-org.github.io/iptv/countries/qa.m3u'),
    ('IPTV-org UAE', 'https://iptv-org.github.io/iptv/countries/ae.m3u'),
]


def classify_league(name, group):
    """Determine which league a channel belongs to. Returns league_id or None."""
    text = f'{name} {group}'.lower()
    for league in LEAGUES:
        # Check exclusions first
        excluded = False
        for ex in league.get('exclude_keywords', []):
            if ex in text:
                excluded = True
                break
        if excluded:
            continue
        # Check keywords
        for kw in league['keywords']:
            if kw in text:
                return league['id']
    return None


def is_sports_related(name, group):
    """Check if channel is likely sports-related (not movies/music/news)."""
    text = f'{name} {group}'.lower()
    # Must have some sports indicator
    sports_indicators = ['sport', 'football', 'soccer', 'futbol', 'nba', 'nfl', 'mlb', 'nhl',
                         'ufc', 'mma', 'wwe', 'racing', 'f1 ', 'motogp', 'nascar',
                         'espn', 'bein', 'fubo', 'stadium', 'olympic', 'ncaa',
                         'fifa', 'world cup', 'premier league', 'la liga', 'serie a',
                         'bundesliga', 'ligue 1', 'champions league', 'europa league',
                         'goal', 'pitch', 'arena', 'combat', 'fight', 'boxing']
    for ind in sports_indicators:
        if ind in text:
            return True
    return False


def main():
    print('🏆 FreeStream TV — Enhanced League Classifier v2')
    print(f'   Wider source list ({len(SOURCES_TO_USE)} sources)')
    print(f'   Better keyword matching with exclusions')
    print(f'   Timeout: {TIMEOUT}s | Workers: {MAX_WORKERS}')
    print()

    # Gather all channels and classify by league
    league_channels = {l['id']: [] for l in LEAGUES}
    seen_urls = set()
    seen_names = set()

    for source_name, source_url in SOURCES_TO_USE:
        print(f'📥 {source_name}')
        try:
            content = fetch_source(source_url)
            channels = parse_m3u(content)
            classified = 0
            for ch in channels:
                if ch['url'] in seen_urls:
                    continue
                # Also dedupe by name (some channels have same name, different URL)
                name_key = ch['name'].lower().strip()[:50]
                if name_key in seen_names:
                    continue

                league_id = classify_league(ch['name'], ch['group'])
                if league_id:
                    # Extra check: ensure it's sports-related
                    if is_sports_related(ch['name'], ch['group']):
                        seen_urls.add(ch['url'])
                        seen_names.add(name_key)
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
                           'candidates': 0, 'working': 0})
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
            print(f'   Sample: {working[0]["name"][:50]}')

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
            'candidates': len(candidates),
            'working': len(working),
        })

    # Final summary
    print(f'\n{"=" * 70}')
    print('🏆 ENHANCED LEAGUE CLASSIFICATION COMPLETE')
    print(f'{"=" * 70}')
    print(f'{"League":<30} {"Candidates":<12} {"Working":<10}')
    print('-' * 70)
    total_working = 0
    for s in summary:
        print(f'{s["flag"]} {s["name"]:<27} {s["candidates"]:<12} {s["working"]:<10}')
        total_working += s['working']
    print('-' * 70)
    print(f'{"TOTAL":<30} {"":<12} {total_working:<10}')

    summary_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leagues-summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f'\nSummary: {summary_path}')


if __name__ == '__main__':
    main()
