package com.freestream.tv;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class M3UParser {

    public static List<Channel> parse(InputStream inputStream) {
        List<Channel> channels = new ArrayList<>();
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
            String line;
            Channel current = null;
            int idCounter = 0;
            Pattern attrPattern = Pattern.compile("([a-zA-Z0-9-]+)=\"([^\"]*)\"");
            Pattern qualityPattern = Pattern.compile("\\b(4K|8K|FHD|UHD|HD|SD|1080p|720p|576p|480p|360p)\\b", Pattern.CASE_INSENSITIVE);

            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;
                if (line.startsWith("#EXTM3U")) continue;

                if (line.startsWith("#EXTINF")) {
                    current = new Channel();
                    current.id = "ch-" + (idCounter++);

                    // Parse attributes
                    Matcher m = attrPattern.matcher(line);
                    while (m.find()) {
                        String key = m.group(1).toLowerCase();
                        String val = m.group(2);
                        if (key.equals("tvg-logo")) current.logo = val;
                        else if (key.equals("group-title")) current.group = val != null ? val : "Other";
                        else if (key.equals("tvg-name")) current.displayName = val;
                    }

                    // Extract name (after comma)
                    int commaIdx = line.lastIndexOf(',');
                    if (commaIdx != -1) {
                        current.name = line.substring(commaIdx + 1).trim();
                    } else {
                        current.name = "Unknown";
                    }

                    // Clean display name
                    if (current.displayName == null || current.displayName.isEmpty()) {
                        current.displayName = current.name;
                    }
                    // Remove quality suffix from display name
                    current.displayName = current.displayName
                        .replaceAll("\\s+(FHD|UHD|HD|SD|4K|8K)\\b.*$", "")
                        .replaceAll("\\s+\\d{3,4}p\\b.*$", "")
                        .replaceAll("\\s*\\[[^]]+]\\s*", "")
                        .trim();
                    if (current.displayName.isEmpty()) current.displayName = current.name;

                    // Detect quality
                    Matcher qm = qualityPattern.matcher(current.name);
                    if (qm.find()) {
                        String q = qm.group(1).toUpperCase();
                        if (q.equals("2160P") || q.equals("4K")) current.quality = "4K";
                        else if (q.equals("FHD") || q.equals("1080P")) current.quality = "1080p";
                        else if (q.equals("HD") || q.equals("720P")) current.quality = "720p";
                        else if (q.equals("UHD")) current.quality = "4K";
                        else current.quality = q;
                    }

                    // Detect VOD
                    String lowerUrl = "";
                    current.isVod = false;
                } else if (!line.startsWith("#") && current != null) {
                    current.url = line;
                    // Check VOD
                    current.isVod = line.matches(".*\\.(mp4|mkv|avi|mov|webm)(\\?.*)?$") &&
                                   !line.contains(".m3u8") && !line.contains("/live/");
                    channels.add(current);
                    current = null;
                }
            }
            reader.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return channels;
    }

    public static List<Channel> loadBundledPlaylists(Context context) {
        List<Channel> all = new ArrayList<>();
        String[] playlists = {"sports", "news", "movies", "music", "kids", "entertainment", "documentary", "international"};
        for (String pl : playlists) {
            try {
                InputStream is = context.getAssets().open("playlists/" + pl + ".m3u");
                List<Channel> channels = parse(is);
                for (Channel ch : channels) {
                    if (ch.group == null || ch.group.isEmpty()) ch.group = pl.substring(0, 1).toUpperCase() + pl.substring(1);
                    else ch.group = ch.group + " (" + pl + ")";
                }
                all.addAll(channels);
                is.close();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return all;
    }

    // Favorites management using SharedPreferences
    private static final String PREFS_NAME = "freestream_prefs";
    private static final String FAV_KEY = "favorites";
    private static final String RECENT_KEY = "recent";

    public static Set<String> getFavorites(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return new HashSet<>(prefs.getStringSet(FAV_KEY, new HashSet<>()));
    }

    public static void toggleFavorite(Context ctx, String url) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> favs = new HashSet<>(prefs.getStringSet(FAV_KEY, new HashSet<>()));
        if (favs.contains(url)) favs.remove(url);
        else favs.add(url);
        prefs.edit().putStringSet(FAV_KEY, favs).apply();
    }

    public static boolean isFavorite(Context ctx, String url) {
        return getFavorites(ctx).contains(url);
    }

    public static List<String> getRecent(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(RECENT_KEY, "");
        List<String> recent = new ArrayList<>();
        if (json != null && !json.isEmpty() && json.startsWith("[")) {
            // Simple parse: split by delimiter
            String[] parts = json.replace("[", "").replace("]", "").split("\\|");
            for (String p : parts) {
                if (!p.isEmpty()) recent.add(p);
            }
        }
        return recent;
    }

    public static void addRecent(Context ctx, String url) {
        List<String> recent = getRecent(ctx);
        recent.remove(url);
        recent.add(0, url);
        while (recent.size() > 20) recent.remove(recent.size() - 1);
        // Simple JSON-like format: [url1|url2|url3]
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < recent.size(); i++) {
            if (i > 0) sb.append("|");
            sb.append(recent.get(i));
        }
        sb.append("]");
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(RECENT_KEY, sb.toString()).apply();
    }
}
