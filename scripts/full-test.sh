#!/bin/bash
# Comprehensive end-to-end test — FIXED with correct IDs and grep pattern
set -e

cd /home/z/my-project/.next/standalone

pkill -9 -f "node server.js" 2>/dev/null || true
sleep 2

setsid node server.js </dev/null >/home/z/my-project/prod.log 2>&1 &
disown
sleep 6

if ! curl -s -o /dev/null http://localhost:3000/; then
  echo "FAILED: Server did not start"
  exit 1
fi

echo "============================================"
echo "  FREESTREAM TV — FULL END-TO-END TEST"
echo "============================================"
echo "Server: HTTP $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
echo "Preview: HTTP $(curl -s -o /dev/null -w '%{http_code}' http://localhost:81/)"
echo ""

PASS=0
FAIL=0
TOTAL=0

test_endpoint() {
  TOTAL=$((TOTAL + 1))
  local name="$1"
  local url="$2"
  local result
  result=$(curl -s -m 30 "$url" 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if 'channels' in d:
        n = len(d['channels'])
        print(f'{n} channels')
    elif 'totalCount' in d:
        print(f'{d[\"totalCount\"]} channels')
    elif 'ok' in d:
        print(f'ok={d[\"ok\"]}')
    elif 'user_info' in d:
        print(f'auth={d[\"user_info\"][\"auth\"]}')
    elif 'service' in d:
        print(d['service'])
    elif 'error' in d:
        print(f'ERROR: {d[\"error\"][:80]}')
    else:
        print('ok')
except:
    print('PARSE_FAIL')
" 2>&1)
  # FIXED: only match exact "0 channels" or ERROR or PARSE_FAIL
  if echo "$result" | grep -qE "^0 channels|^ERROR|^PARSE_FAIL"; then
    FAIL=$((FAIL + 1))
    echo "FAIL  $name → $result"
  else
    PASS=$((PASS + 1))
    echo "PASS  $name → $result"
  fi
}

test_status() {
  TOTAL=$((TOTAL + 1))
  local name="$1"
  local url="$2"
  local status
  status=$(curl -s -o /dev/null -m 30 -w '%{http_code}' "$url" 2>/dev/null)
  if [ "$status" = "200" ] || [ "$status" = "302" ]; then
    PASS=$((PASS + 1))
    echo "PASS  $name → HTTP $status"
  else
    FAIL=$((FAIL + 1))
    echo "FAIL  $name → HTTP $status"
  fi
}

echo "=== 1. HOMEPAGE ==="
test_status "Homepage" "http://localhost:3000/"
echo ""

echo "=== 2. CORE APIs ==="
test_endpoint "Playlist API" "http://localhost:3000/api/playlist?provider=best-of&category=sports"
test_status "EPG API" "http://localhost:3000/api/epg?channel=test&limit=1"
test_status "TV Guide API" "http://localhost:3000/api/tv-guide?limit=10"
test_status "Trending API" "http://localhost:3000/api/trending"
test_endpoint "Xtream proxy" "http://localhost:3000/api/xtream"
echo ""

echo "=== 3. MOCK XTREAM CODES ==="
test_endpoint "XC Auth" "http://localhost:3000/api/xtream-mock?path=player_api.php&username=test&password=test"
test_endpoint "XC Live Cats" "http://localhost:3000/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_live_categories"
test_endpoint "XC Live Streams" "http://localhost:3000/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_live_streams"
test_endpoint "XC VOD Cats" "http://localhost:3000/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_vod_categories"
test_endpoint "XC VOD Streams" "http://localhost:3000/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_vod_streams"
test_endpoint "XC Series Cats" "http://localhost:3000/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_series_categories"
test_endpoint "XC Series" "http://localhost:3000/api/xtream-mock?path=player_api.php&username=test&password=test&action=get_series"
test_status "XC M3U" "http://localhost:3000/api/xtream-mock?path=get.php&username=test&password=test"
test_status "XC Stream 101" "http://localhost:3000/api/xtream-mock/live/test/test/101.m3u8"
test_status "XC Stream 201" "http://localhost:3000/api/xtream-mock/live/test/test/201.m3u8"
test_status "XC VOD 1001" "http://localhost:3000/api/xtream-mock/movie/test/test/1001.mp4"
echo ""

echo "=== 4. TWITCH RESOLVER ==="
test_endpoint "Twitch stableronaldo" "http://localhost:3000/api/twitch?channel=stableronaldo"
echo ""

echo "=== 5. BEST OF FREESTREAM (10 categories) ==="
for cat in sports movies news music kids entertainment documentary international religious education; do
  test_endpoint "Best-of $cat" "http://localhost:3000/api/playlist?provider=best-of&category=$cat"
done
echo ""

echo "=== 6. SPORTS BY CATEGORY (9 subcats) ==="
test_endpoint "Sports All" "http://localhost:3000/api/playlist?provider=sports-cats&category=all-sports"
for pl in football soccer basketball baseball hockey combat racing college general; do
  test_endpoint "Sports $pl" "http://localhost:3000/api/playlist?provider=sports-cats&category=subcats&playlist=$pl"
done
echo ""

echo "=== 7. MOVIES BY CATEGORY (8 subcats) ==="
test_endpoint "Movies All" "http://localhost:3000/api/playlist?provider=movies-cats&category=all-movies"
for pl in action comedy drama horror classic western scifi general; do
  test_endpoint "Movies $pl" "http://localhost:3000/api/playlist?provider=movies-cats&category=subcats&playlist=$pl"
done
echo ""

echo "=== 8. COUNTRIES (10) ==="
for pl in it id us es gr cz ru in fr gb de ar kr ua fi; do
  test_endpoint "Country $pl" "http://localhost:3000/api/playlist?provider=countries&category=all-countries&playlist=$pl"
done
echo ""

echo "=== 9. LEAGUES (FIXED: category=all-leagues) ==="
for pl in premier-league la-liga champions-league europa-league world-cup-2026 other-football nfl nba mlb nhl ufc-mma f1-racing college-sports; do
  test_endpoint "League $pl" "http://localhost:3000/api/playlist?provider=leagues&category=all-leagues&playlist=$pl"
done
echo ""

echo "=== 10. WORLD REGIONS (FIXED: provider=world-regions, category=all-regions) ==="
for pl in europe east-southeast-asia north-america south-central-america middle-east-north-africa south-asia sub-saharan-africa oceania; do
  test_endpoint "Region $pl" "http://localhost:3000/api/playlist?provider=world-regions&category=all-regions&playlist=$pl"
done
echo ""

echo "=== 11. FAST PLATFORMS (FIXED: category=by-country) ==="
test_endpoint "Pluto TV US" "http://localhost:3000/api/playlist?provider=pluto-tv&category=by-country&playlist=us"
test_endpoint "Pluto TV UK" "http://localhost:3000/api/playlist?provider=pluto-tv&category=by-country&playlist=uk"
test_endpoint "Samsung US" "http://localhost:3000/api/playlist?provider=samsung-tv&category=by-country&playlist=us"
test_endpoint "Samsung UK" "http://localhost:3000/api/playlist?provider=samsung-tv&category=by-country&playlist=uk"
test_endpoint "LG US" "http://localhost:3000/api/playlist?provider=lg-channels&category=by-country&playlist=us"
test_endpoint "LG UK" "http://localhost:3000/api/playlist?provider=lg-channels&category=by-country&playlist=gb"
test_endpoint "Tubi" "http://localhost:3000/api/playlist?provider=tubi&category=all"
test_endpoint "Roku" "http://localhost:3000/api/playlist?provider=roku&category=all"
echo ""

echo "=== 12. IPTV-ORG ==="
test_endpoint "IPTV Arabic" "http://localhost:3000/api/playlist?provider=iptv-org&category=by-language&playlist=ara"
test_endpoint "IPTV English" "http://localhost:3000/api/playlist?provider=iptv-org&category=by-language&playlist=eng"
test_endpoint "IPTV French" "http://localhost:3000/api/playlist?provider=iptv-org&category=by-language&playlist=fra"
test_endpoint "IPTV Sports" "http://localhost:3000/api/playlist?provider=iptv-org&category=by-genre&playlist=sports"
test_endpoint "IPTV News" "http://localhost:3000/api/playlist?provider=iptv-org&category=by-genre&playlist=news"
test_endpoint "IPTV Movies" "http://localhost:3000/api/playlist?provider=iptv-org&category=by-genre&playlist=movies"
echo ""

echo "=== 13. CHINA & ASIA ==="
test_endpoint "China CCTV" "http://localhost:3000/api/playlist?provider=cn-iptv&category=cn-regional&playlist=cn-cctv"
test_endpoint "China National" "http://localhost:3000/api/playlist?provider=cn-iptv&category=cn-regional&playlist=cn-national"
test_endpoint "China International" "http://localhost:3000/api/playlist?provider=cn-iptv&category=international&playlist=intl-channels"
echo ""

echo "=== 14. AUTO-UPDATED ==="
test_endpoint "CricHD" "http://localhost:3000/api/playlist?provider=auto-updated&category=cric-sports&playlist=crichd&refresh=1"
test_endpoint "T-Sports" "http://localhost:3000/api/playlist?provider=auto-updated&category=cric-sports&playlist=t-sports-universal&refresh=1"
test_endpoint "SM Combined" "http://localhost:3000/api/playlist?provider=auto-updated&category=cric-sports&playlist=sm-combined&refresh=1"
test_endpoint "SM World Cup" "http://localhost:3000/api/playlist?provider=auto-updated&category=cric-sports&playlist=sm-world-cup&refresh=1"
test_endpoint "Toffee" "http://localhost:3000/api/playlist?provider=auto-updated&category=ireentv&playlist=toffee&refresh=1"
test_endpoint "Tapmad" "http://localhost:3000/api/playlist?provider=auto-updated&category=ireentv&playlist=tapmad&refresh=1"
echo ""

echo "=== 15. TWITCH & YOUTUBE (8 categories) ==="
test_endpoint "Twitch Sports" "http://localhost:3000/api/playlist?provider=embeds&category=twitch-sports&playlist=twitch-espn"
test_endpoint "Twitch Gaming" "http://localhost:3000/api/playlist?provider=embeds&category=twitch-gaming&playlist=twitch-xbox"
test_endpoint "Twitch Music" "http://localhost:3000/api/playlist?provider=embeds&category=twitch-music&playlist=twitch-monstercat"
test_endpoint "Twitch IRL" "http://localhost:3000/api/playlist?provider=embeds&category=twitch-irl&playlist=twitch-twitch"
test_endpoint "Twitch Esports" "http://localhost:3000/api/playlist?provider=embeds&category=twitch-esports&playlist=twitch-esl"
test_endpoint "YouTube News" "http://localhost:3000/api/playlist?provider=embeds&category=youtube-news&playlist=yt-skynews"
test_endpoint "YouTube Music" "http://localhost:3000/api/playlist?provider=embeds&category=youtube-music&playlist=yt-lofi"
test_endpoint "YouTube Entertain" "http://localhost:3000/api/playlist?provider=embeds&category=youtube-entertainment&playlist=yt-nasa"
echo ""

echo "=== 16. VIRTUAL PROVIDERS ==="
test_endpoint "My Channels" "http://localhost:3000/api/playlist?provider=my-channels&category=all"
echo ""

echo ""
echo "============================================"
echo "  FINAL RESULTS"
echo "============================================"
echo "  TOTAL: $TOTAL"
echo "  PASS:  $PASS"
echo "  FAIL:  $FAIL"
echo "  RATE:  $((PASS * 100 / TOTAL))%"
echo "============================================"
