#!/bin/bash
# Provider-by-Provider Channel Analyzer (Bash version — low memory)
# Uses curl with 10s timeout instead of Python requests
# Processes one channel at a time to avoid OOM

ANALYZER_DIR="/home/z/my-project"
OUTPUT_DIR="$ANALYZER_DIR/public/filtered-v2"
mkdir -p "$OUTPUT_DIR"

TIMEOUT=10

# Function to check a single URL
check_url() {
  local url="$1"
  local status
  
  if [[ "$url" == *".m3u8"* ]] || [[ "$url" == *"m3u8"* ]]; then
    # HLS — check manifest
    status=$(curl -sL --max-time $TIMEOUT -o /dev/null -w "%{http_code}" \
      -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18" \
      "$url" 2>/dev/null)
  else
    # Direct file
    status=$(curl -sIL --max-time $TIMEOUT -o /dev/null -w "%{http_code}" \
      -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18" \
      "$url" 2>/dev/null)
    if [ "$status" != "200" ]; then
      status=$(curl -sL --max-time $TIMEOUT -o /dev/null -w "%{http_code}" \
        -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18" \
        "$url" 2>/dev/null)
    fi
  fi
  
  if [ "$status" = "200" ]; then
    echo "OK"
  else
    echo "DEAD"
  fi
}

# Function to analyze an M3U file
analyze_file() {
  local label="$1"
  local input_file="$2"
  local output_file="$3"
  
  if [ ! -f "$input_file" ]; then
    echo "  ⚠️ File not found: $input_file"
    return
  fi
  
  local total=$(grep -c "^#EXTINF" "$input_file")
  echo "  Channels: $total"
  
  if [ "$total" -eq 0 ]; then
    echo "  ⚠️ Empty — skipping"
    return
  fi
  
  local working=0
  local dead=0
  local current=0
  
  # Create temp files
  > "/tmp/working_$$.m3u"
  echo "#EXTM3U" > "/tmp/working_$$.m3u"
  
  # Read file line by line
  local extinf=""
  while IFS= read -r line; do
    line=$(echo "$line" | tr -d '\r')
    
    if [[ "$line" =~ ^#EXTINF ]]; then
      extinf="$line"
    elif [[ "$line" =~ ^# ]]; then
      continue
    elif [[ -n "$line" ]] && [[ "$line" != "" ]]; then
      current=$((current + 1))
      
      # Progress every 25
      if [ $((current % 25)) -eq 0 ]; then
        echo "  Progress: $current/$total"
      fi
      
      # Check URL
      result=$(check_url "$line")
      
      if [ "$result" = "OK" ]; then
        working=$((working + 1))
        echo "$extinf" >> "/tmp/working_$$.m3u"
        echo "$line" >> "/tmp/working_$$.m3u"
      else
        dead=$((dead + 1))
      fi
      
      extinf=""
    fi
  done < "$input_file"
  
  # Save filtered file
  if [ "$working" -gt 0 ]; then
    cp "/tmp/working_$$.m3u" "$OUTPUT_DIR/$output_file"
    echo "  ✅ Working: $working | ❌ Dead: $dead"
    echo "  💾 Saved: filtered-v2/$output_file"
  else
    echo "  ⚠️ No working channels"
  fi
  
  rm -f "/tmp/working_$$.m3u"
}

echo "🔍 FreeStream TV — Provider-by-Provider Analyzer (Bash)"
echo "   Timeout: ${TIMEOUT}s per URL | Sequential (low memory)"
echo ""

# Sports subcategories
echo "=== Sports ==="
for sport in soccer general-sports combat extreme-outdoor tennis-golf racing cricket-rugby hockey basketball american-football college baseball; do
  echo "[Sports → $sport]"
  analyze_file "Sports $sport" "$ANALYZER_DIR/public/sports/$sport.m3u" "sports-$sport.m3u"
done

# Best of FreeStream
echo ""
echo "=== Best of FreeStream ==="
for cat in sports movies news music kids entertainment documentary international religious education; do
  echo "[Best of → $cat]"
  analyze_file "Best of $cat" "$ANALYZER_DIR/public/curated/$cat.m3u" "best-of-$cat.m3u"
done

# Leagues
echo ""
echo "=== Leagues ==="
for league in premier-league la-liga champions-league europa-league world-cup-2026 other-football nfl nba mlb nhl ufc-mma f1-racing college-sports; do
  echo "[Leagues → $league]"
  analyze_file "Leagues $league" "$ANALYZER_DIR/public/leagues/$league.m3u" "leagues-$league.m3u"
done

# Countries (top 15)
echo ""
echo "=== Countries ==="
for country in it id us es gr cz ru in fr gb de ar kr tr; do
  echo "[Countries → $country]"
  analyze_file "Country $country" "$ANALYZER_DIR/public/countries/$country.m3u" "countries-$country.m3u"
done

# World Regions
echo ""
echo "=== World Regions ==="
for region in north-america middle-east-north-africa south-central-america south-asia; do
  echo "[Regions → $region]"
  analyze_file "Region $region" "$ANALYZER_DIR/public/regions/$region.m3u" "regions-$region.m3u"
done

# beIN
echo ""
echo "=== beIN Sports ==="
analyze_file "beIN" "$ANALYZER_DIR/public/filtered/bein-verified.m3u" "bein-verified.m3u"

# IPTV4ON
echo ""
echo "=== IPTV4ON ==="
analyze_file "IPTV4ON" "$ANALYZER_DIR/public/filtered/iptv4on-all.m3u" "iptv4on-all.m3u"

# Free-TV
echo ""
echo "=== Free-TV ==="
analyze_file "Free-TV" "$ANALYZER_DIR/public/filtered/free-tv-all.m3u" "free-tv-all.m3u"

echo ""
echo "=== DONE ==="
echo "Files generated:"
ls "$OUTPUT_DIR/" | wc -l
echo "Total channels in all files:"
cat "$OUTPUT_DIR/"*.m3u 2>/dev/null | grep -c "^#EXTINF"
