#!/usr/bin/env python3
"""
Expanded curator — builds 200-channel sports & movies playlists with subcategories.

Sports subcategories: Football, Basketball, Baseball, Hockey, Soccer, Combat, Racing, Olympics, College, General Sports
Movies subcategories: Action, Comedy, Drama, Horror, Classic, Family, Western, Sci-Fi, Documentary, General Movies

Also generates the main sports.m3u and movies.m3u (200 channels each) by combining subcategories.
"""

import os
import re
import sys
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curate_best_100 import check_url, parse_m3u, fetch_source, SOURCES, HEADERS, TIMEOUT, MAX_WORKERS

# ─── Sports subcategories ────────────────────────────────────────────────────
SPORTS_SUBCATS = [
    {
        'id': 'football',
        'name': 'Football (American)',
        'flag': '🏈',
        'keywords': ['nfl', 'football', 'gridiron', 'super bowl', 'touchdown'],
        'exclude': ['soccer', 'fifa', 'premier league', 'laliga', 'serie a', 'bundesliga'],
    },
    {
        'id': 'soccer',
        'name': 'Soccer',
        'flag': '⚽',
        'keywords': ['soccer', 'fifa', 'premier league', 'laliga', 'la liga', 'serie a',
                     'bundesliga', 'mls soccer', 'champions league', 'europa league',
                     'world cup', 'fa cup', 'copa', 'ligue 1', 'eredivisie',
                     'primeira liga', 'scottish premiership', 'soccer anthems'],
        'exclude': ['nfl', 'american football'],
    },
    {
        'id': 'basketball',
        'name': 'Basketball',
        'flag': '🏀',
        'keywords': ['nba', 'basketball', 'ncaa basketball', 'hoops', 'lakers',
                     'celtics', 'bulls', 'warriors'],
        'exclude': [],
    },
    {
        'id': 'baseball',
        'name': 'Baseball',
        'flag': '⚾',
        'keywords': ['mlb', 'baseball', 'world series', 'pitch', 'batting',
                     'softball'],
        'exclude': [],
    },
    {
        'id': 'hockey',
        'name': 'Hockey',
        'flag': '🏒',
        'keywords': ['nhl', 'hockey', 'ice hockey', 'field hockey'],
        'exclude': [],
    },
    {
        'id': 'combat',
        'name': 'Combat & Fighting',
        'flag': '🥊',
        'keywords': ['ufc', 'wwe', 'wrestling', 'boxing', 'mma', 'martial arts',
                     'fight', 'combat', 'judo', 'karate', 'taekwondo'],
        'exclude': [],
    },
    {
        'id': 'racing',
        'name': 'Racing & Motorsport',
        'flag': '🏎️',
        'keywords': ['racing', 'nascar', 'formula', 'f1', 'motogp', 'rally',
                     'drag racing', 'speedway', 'auto racing', 'motorcycle',
                     'horse racing', 'greyhound'],
        'exclude': [],
    },
    {
        'id': 'college',
        'name': 'College Sports',
        'flag': '🎓',
        'keywords': ['ncaa', 'college', 'university', 'campus', 'student athlete'],
        'exclude': [],
    },
    {
        'id': 'general-sports',
        'name': 'General Sports',
        'flag': '🏆',
        'keywords': ['sport', 'espn', 'bein', 'fubo sports', 'stadium',
                     'fox sports', 'nbc sports', 'cbs sports', 'tnt sports',
                     'sky sports', 'sports network', 'action sports',
                     'extreme sports', 'outdoor', 'fishing', 'hunting',
                     'golf', 'tennis', 'cricket', 'volleyball', 'rugby',
                     'handball', 'table tennis', 'badminton', 'squash',
                     'skiing', 'snowboarding', 'surfing', 'skateboarding',
                     'bmx', 'climbing', 'hiking', 'cycling', 'running'],
        'exclude': [],
    },
]

# ─── Movies subcategories ────────────────────────────────────────────────────
MOVIES_SUBCATS = [
    {
        'id': 'action',
        'name': 'Action',
        'flag': '💥',
        'keywords': ['action', 'thriller', 'adventure', 'spy', 'war movie',
                     'crime movie', 'noir', 'suspense'],
        'exclude': ['comedy'],
    },
    {
        'id': 'comedy',
        'name': 'Comedy',
        'flag': '😂',
        'keywords': ['comedy', 'funny', 'humor', 'sitcom', 'joke', 'hilarious'],
        'exclude': ['horror'],
    },
    {
        'id': 'drama',
        'name': 'Drama',
        'flag': '🎭',
        'keywords': ['drama', 'romance', 'romantic', 'love story', 'passion',
                     'tearjerker', 'period drama', 'bollywood drama'],
        'exclude': ['comedy', 'horror', 'action'],
    },
    {
        'id': 'horror',
        'name': 'Horror',
        'flag': '👻',
        'keywords': ['horror', 'scary', 'terror', 'slasher', 'zombie',
                     'vampire', 'ghost', 'haunted', 'creepy', 'fear'],
        'exclude': ['comedy'],
    },
    {
        'id': 'classic',
        'name': 'Classic Movies',
        'flag': '📽️',
        'keywords': ['classic', 'retro', 'vintage', 'old movie', 'golden age',
                     'silver screen', 'cinevault', 'classic movie',
                     'western classic'],
        'exclude': [],
    },
    {
        'id': 'family',
        'name': 'Family Movies',
        'flag': '👨‍👩‍👧',
        'keywords': ['family movie', 'kids movie', 'family film', 'children movie',
                     'animated movie', 'cartoon movie', 'disney movie',
                     'pixar', 'dreamworks'],
        'exclude': ['horror'],
    },
    {
        'id': 'western',
        'name': 'Western',
        'flag': '🤠',
        'keywords': ['western', 'cowboy', 'frontier', 'wild west', 'outlaw',
                     'sheriff', 'saloon'],
        'exclude': [],
    },
    {
        'id': 'scifi',
        'name': 'Sci-Fi & Fantasy',
        'flag': '🚀',
        'keywords': ['sci-fi', 'science fiction', 'scifi', 'fantasy', 'space',
                     'alien', 'robot', 'cyberpunk', 'dystopia', 'magic',
                     'wizard', 'dragon', 'superhero'],
        'exclude': [],
    },
    {
        'id': 'general-movies',
        'name': 'General Movies',
        'flag': '🎬',
        'keywords': ['movie', 'cinema', 'film', 'cine', 'flick', 'hollywood',
                     'bollywood', 'movieplex', 'moviestime', 'movie channel',
                     'moviesphere', 'filmrise', 'cineverse', 'cinevault',
                     'free movies', 'movie zone'],
        'exclude': [],
    },
]


def classify_subcategory(name, group, subcats):
    """Determine which subcategory a channel belongs to."""
    text = f'{name} {group}'.lower()
    for sub in subcats:
        excluded = False
        for ex in sub['exclude']:
            if ex in text:
                excluded = True
                break
        if excluded:
            continue
        for kw in sub['keywords']:
            if kw in text:
                return sub['id']
    return None


def curate_genre_with_subcats(genre_id, genre_name, genre_flag, subcats, target_per_sub=25, target_total=200):
    """Curate a genre with subcategories. Returns dict of subcat_id -> [channels]."""
    print(f'\n🏆 Curating {genre_flag} {genre_name} (target: {target_total} channels)')

    # Step 1: Gather all genre candidates from sources
    genre_keywords = set()
    for sub in subcats:
        genre_keywords.update(sub['keywords'])

    candidates = []
    seen_urls = set()

    for source_name, source_url in SOURCES:
        try:
            content = fetch_source(source_url)
            channels = parse_m3u(content)
            for ch in channels:
                if ch['url'] in seen_urls:
                    continue
                text = f'{ch["name"]} {ch["group"]}'.lower()
                # Check if it matches any subcategory
                matched = False
                for sub in subcats:
                    excluded = False
                    for ex in sub['exclude']:
                        if ex in text:
                            excluded = True
                            break
                    if excluded:
                        continue
                    for kw in sub['keywords']:
                        if kw in text:
                            seen_urls.add(ch['url'])
                            candidates.append({**ch, 'source': source_name})
                            matched = True
                            break
                    if matched:
                        break
        except Exception as e:
            print(f'  ⚠️ {source_name}: {e}')

    print(f'  📥 {len(candidates)} candidates gathered')

    # Step 2: Classify into subcategories
    subcat_candidates = {sub['id']: [] for sub in subcats}
    for ch in candidates:
        sub_id = classify_subcategory(ch['name'], ch['group'], subcats)
        if sub_id:
            subcat_candidates[sub_id].append(ch)
        else:
            # Put unmatched into the "general" subcat
            general_id = [s['id'] for s in subcats if 'general' in s['id']][0]
            subcat_candidates[general_id].append(ch)

    print('  📊 Candidates per subcategory:')
    for sub in subcats:
        print(f'     {sub["flag"]} {sub["name"]}: {len(subcat_candidates[sub["id"]])}')

    # Step 3: Test channels per subcategory (up to 50 to find 25 working)
    result = {}
    all_working = []

    for sub in subcats:
        sub_id = sub['id']
        sub_cands = subcat_candidates[sub_id][:60]  # Test up to 60
        target = target_per_sub

        print(f'\n  🔍 Testing {sub["flag"]} {sub["name"]}: {len(sub_cands)} candidates')

        results = {}
        def check_one(idx_ch):
            idx, ch = idx_ch
            works, reason = check_url(ch['url'])
            return idx, works, reason

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(check_one, (i, ch)): i for i, ch in enumerate(sub_cands)}
            for future in as_completed(futures):
                idx, works, reason = future.result()
                results[idx] = (works, reason)

        working = []
        for idx, ch in enumerate(sub_cands):
            if idx in results and results[idx][0]:
                working.append(ch)
                if len(working) >= target:
                    break

        result[sub_id] = working
        all_working.extend(working)
        print(f'     ✅ {len(working)} working (target: {target})')

    # Step 4: Save subcategory files
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'curated')

    for sub in subcats:
        sub_id = sub['id']
        working = result[sub_id]
        if working:
            output_file = f'{genre_id}-{sub_id}.m3u'
            output_path = os.path.join(output_dir, output_file)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(f'#EXTM3U\n# {sub["name"]} — curated by FreeStream TV ({len(working)} channels)\n')
                seen = set()
                for ch in working:
                    if ch['url'] not in seen:
                        f.write(f'{ch["extinf"]}\n')
                        f.write(f'{ch["url"]}\n')
                        seen.add(ch['url'])
            print(f'  💾 Saved: public/curated/{output_file} ({len(working)} channels)')

    # Step 5: Save combined genre file (deduplicated, capped at target_total)
    seen = set()
    combined = []
    for ch in all_working:
        if ch['url'] not in seen:
            seen.add(ch['url'])
            combined.append(ch)
            if len(combined) >= target_total:
                break

    combined_file = f'{genre_id}.m3u'
    combined_path = os.path.join(output_dir, combined_file)
    with open(combined_path, 'w', encoding='utf-8') as f:
        f.write(f'#EXTM3U\n# Best {len(combined)} {genre_name} — curated by FreeStream TV\n')
        for ch in combined:
            f.write(f'{ch["extinf"]}\n')
            f.write(f'{ch["url"]}\n')
    print(f'  💾 Saved combined: public/curated/{combined_file} ({len(combined)} channels)')

    return result, combined


def main():
    print('🎯 FreeStream TV — Expanded Curator (Sports & Movies with subcategories)')
    print(f'   Timeout: {TIMEOUT}s | Workers: {MAX_WORKERS}')
    print()

    # Curate Sports (200 channels, 10 subcategories × 20 each)
    sports_result, sports_combined = curate_genre_with_subcats(
        'sports', 'Sports', '⚽', SPORTS_SUBCATS, target_per_sub=20, target_total=200
    )

    # Curate Movies (200 channels, 9 subcategories × ~22 each)
    movies_result, movies_combined = curate_genre_with_subcats(
        'movies', 'Movies', '🎬', MOVIES_SUBCATS, target_per_sub=22, target_total=200
    )

    # Final summary
    print(f'\n{"=" * 70}')
    print('🏆 EXPANDED CURATION COMPLETE')
    print(f'{"=" * 70}')
    print(f'\n⚽ Sports: {len(sports_combined)} channels across {len(SPORTS_SUBCATS)} subcategories')
    for sub in SPORTS_SUBCATS:
        count = len(sports_result.get(sub['id'], []))
        print(f'   {sub["flag"]} {sub["name"]}: {count}')

    print(f'\n🎬 Movies: {len(movies_combined)} channels across {len(MOVIES_SUBCATS)} subcategories')
    for sub in MOVIES_SUBCATS:
        count = len(movies_result.get(sub['id'], []))
        print(f'   {sub["flag"]} {sub["name"]}: {count}')

    total = len(sports_combined) + len(movies_combined)
    print(f'\n✅ Total curated: {total} channels')


if __name__ == '__main__':
    main()
