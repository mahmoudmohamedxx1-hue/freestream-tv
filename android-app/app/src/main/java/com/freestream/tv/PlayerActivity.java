package com.freestream.tv;

import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.common.util.Util;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.ui.PlayerView;

public class PlayerActivity extends AppCompatActivity {

    private ExoPlayer player;
    private PlayerView playerView;
    private ProgressBar progressBar;
    private TextView errorText;
    private String streamUrl;
    private String channelName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_player);

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        streamUrl = getIntent().getStringExtra("url");
        channelName = getIntent().getStringExtra("name");

        playerView = findViewById(R.id.playerView);
        progressBar = findViewById(R.id.progressBar);
        errorText = findViewById(R.id.errorText);
        TextView titleText = findViewById(R.id.channelTitle);
        titleText.setText(channelName != null ? channelName : "FreeStream TV");

        ImageButton backButton = findViewById(R.id.backButton);
        backButton.setOnClickListener(v -> finish());

        if (streamUrl == null || streamUrl.isEmpty()) {
            showError("No stream URL");
            return;
        }

        initPlayer();
    }

    private void initPlayer() {
        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);

        // Build media source — ExoPlayer handles HLS natively
        DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(this);
        HlsMediaSource.Factory hlsFactory = new HlsMediaSource.Factory(dataSourceFactory);

        MediaItem mediaItem = MediaItem.fromUri(streamUrl);
        
        // Check if it's HLS (.m3u8) or a direct file
        if (streamUrl.contains(".m3u8") || streamUrl.contains("/live/")) {
            player.setMediaSource(hlsFactory.createMediaSource(mediaItem));
        } else {
            player.setMediaItem(mediaItem);
        }
        
        player.prepare();
        player.setPlayWhenReady(true);

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                switch (state) {
                    case Player.STATE_BUFFERING:
                        progressBar.setVisibility(View.VISIBLE);
                        errorText.setVisibility(View.GONE);
                        break;
                    case Player.STATE_READY:
                        progressBar.setVisibility(View.GONE);
                        errorText.setVisibility(View.GONE);
                        break;
                    case Player.STATE_ENDED:
                        progressBar.setVisibility(View.GONE);
                        break;
                    case Player.STATE_IDLE:
                        progressBar.setVisibility(View.GONE);
                        break;
                }
            }

            @Override
            public void onPlayerError(androidx.media3.common.PlaybackException error) {
                progressBar.setVisibility(View.GONE);
                String msg = "Stream error: " + error.getMessage();
                if (msg.contains("403")) msg = "Stream blocked (403). May be geo-restricted.";
                else if (msg.contains("404")) msg = "Stream not found (404). Channel may be offline.";
                else if (msg.contains("timeout")) msg = "Stream timeout. Channel may be slow.";
                showError(msg);
            }
        });
    }

    private void showError(String msg) {
        errorText.setText(msg);
        errorText.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.GONE);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null) player.setPlayWhenReady(false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (player != null) player.setPlayWhenReady(true);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (player != null) {
            player.release();
            player = null;
        }
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
    }
}
