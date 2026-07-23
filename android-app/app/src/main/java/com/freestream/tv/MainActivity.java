package com.freestream.tv;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private ChannelAdapter adapter;
    private List<Channel> allChannels = new ArrayList<>();
    private List<Channel> filteredChannels = new ArrayList<>();
    private EditText searchBox;
    private ProgressBar progressBar;
    private TextView emptyText;
    private TextView categoryTitle;
    private LinearLayout categoryBar;
    private Set<String> favorites = new HashSet<>();
    private String currentGroup = "All";
    private boolean showFavsOnly = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        Window window = getWindow();
        window.setStatusBarColor(0xFF060608);

        // Init views
        recyclerView = findViewById(R.id.recyclerView);
        searchBox = findViewById(R.id.searchBox);
        progressBar = findViewById(R.id.progressBar);
        emptyText = findViewById(R.id.emptyText);
        categoryTitle = findViewById(R.id.categoryTitle);
        categoryBar = findViewById(R.id.categoryBar);

        // Setup RecyclerView
        adapter = new ChannelAdapter(filteredChannels, channel -> {
            M3UParser.addRecent(MainActivity.this, channel.url);
            Intent intent = new Intent(MainActivity.this, PlayerActivity.class);
            intent.putExtra("url", channel.url);
            intent.putExtra("name", channel.displayName);
            intent.putExtra("logo", channel.logo);
            startActivity(intent);
        }, this::toggleFavorite);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        // Search
        searchBox.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void afterTextChanged(Editable s) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                filterChannels();
            }
        });

        // Favorites toggle
        findViewById(R.id.favButton).setOnClickListener(v -> {
            showFavsOnly = !showFavsOnly;
            filterChannels();
        });

        // Load channels
        loadChannels();
    }

    private void loadChannels() {
        progressBar.setVisibility(View.VISIBLE);
        emptyText.setVisibility(View.GONE);

        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            allChannels = M3UParser.loadBundledPlaylists(this);
            favorites = M3UParser.getFavorites(this);

            new Handler(Looper.getMainLooper()).post(() -> {
                progressBar.setVisibility(View.GONE);
                buildCategoryBar();
                filterChannels();
            });
        });
    }

    private void buildCategoryBar() {
        categoryBar.removeAllViews();
        Set<String> groups = new HashSet<>();
        for (Channel ch : allChannels) {
            if (ch.group != null) groups.add(ch.group);
        }

        // "All" button
        addCategoryChip("All", v -> { currentGroup = "All"; filterChannels(); });
        // "Favorites" button
        addCategoryChip("❤ Favorites", v -> { showFavsOnly = true; filterChannels(); });

        for (String group : groups) {
            addCategoryChip(group, v -> { currentGroup = group; showFavsOnly = false; filterChannels(); });
        }
    }

    private void addCategoryChip(String text, View.OnClickListener listener) {
        TextView chip = new TextView(this);
        chip.setText(text);
        chip.setTextColor(0xCCFFFFFF);
        chip.setTextSize(13);
        chip.setPadding(40, 20, 40, 20);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMarginEnd(16);
        chip.setLayoutParams(params);
        chip.setOnClickListener(v -> {
            // Reset all chips
            for (int i = 0; i < categoryBar.getChildCount(); i++) {
                View child = categoryBar.getChildAt(i);
                if (child instanceof TextView) {
                    ((TextView) child).setTextColor(0xCCFFFFFF);
                    child.setBackgroundColor(0x00000000);
                }
            }
            // Highlight selected
            chip.setTextColor(0xFFFFFFFF);
            chip.setBackgroundColor(0x33E50914);
            listener.onClick(v);
        });
        categoryBar.addView(chip);
    }

    private void filterChannels() {
        String query = searchBox.getText().toString().toLowerCase().trim();
        filteredChannels.clear();

        for (Channel ch : allChannels) {
            // Favorites filter
            if (showFavsOnly && !favorites.contains(ch.url)) continue;
            // Group filter
            if (!currentGroup.equals("All") && !showFavsOnly) {
                if (ch.group == null || !ch.group.equals(currentGroup)) continue;
            }
            // Search filter
            if (!query.isEmpty()) {
                if (!ch.displayName.toLowerCase().contains(query) &&
                    !ch.name.toLowerCase().contains(query) &&
                    (ch.group == null || !ch.group.toLowerCase().contains(query))) continue;
            }
            ch.isFavorite = favorites.contains(ch.url);
            filteredChannels.add(ch);
        }

        categoryTitle.setText(currentGroup + " (" + filteredChannels.size() + ")");
        adapter.notifyDataSetChanged();
        emptyText.setVisibility(filteredChannels.isEmpty() ? View.VISIBLE : View.GONE);
    }

    private void toggleFavorite(Channel channel) {
        M3UParser.toggleFavorite(this, channel.url);
        favorites = M3UParser.getFavorites(this);
        channel.isFavorite = favorites.contains(channel.url);
        adapter.notifyDataSetChanged();
        Toast.makeText(this, channel.isFavorite ? "Added to favorites" : "Removed from favorites", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onResume() {
        super.onResume();
        favorites = M3UParser.getFavorites(this);
        filterChannels();
    }
}
