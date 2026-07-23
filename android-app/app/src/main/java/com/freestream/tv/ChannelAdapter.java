package com.freestream.tv;

import android.content.Intent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class ChannelAdapter extends RecyclerView.Adapter<ChannelAdapter.ViewHolder> {

    private List<Channel> channels;
    private OnChannelClickListener clickListener;
    private OnFavoriteClickListener favListener;

    public interface OnChannelClickListener {
        void onChannelClick(Channel channel);
    }

    public interface OnFavoriteClickListener {
        void onFavoriteToggle(Channel channel);
    }

    public ChannelAdapter(List<Channel> channels, OnChannelClickListener clickListener, OnFavoriteClickListener favListener) {
        this.channels = channels;
        this.clickListener = clickListener;
        this.favListener = favListener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_channel, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Channel ch = channels.get(position);
        holder.name.setText(ch.displayName);
        holder.group.setText(ch.group != null ? ch.group : "");

        // Quality badge
        if (ch.quality != null && !ch.quality.isEmpty()) {
            holder.quality.setVisibility(View.VISIBLE);
            holder.quality.setText(ch.quality);
        } else {
            holder.quality.setVisibility(View.GONE);
        }

        // VOD badge
        holder.vod.setVisibility(ch.isVod ? View.VISIBLE : View.GONE);

        // Favorite
        holder.fav.setText(ch.isFavorite ? "❤" : "🤍");
        holder.fav.setTextColor(ch.isFavorite ? 0xFFE50914 : 0x80FFFFFF);

        // Logo
        if (ch.logo != null && !ch.logo.isEmpty()) {
            // Use a simple thread to load image (avoid Picasso dependency for now)
            new Thread(() -> {
                try {
                    java.net.URL url = new java.net.URL(ch.logo);
                    android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeStream(url.openStream());
                    holder.logo.post(() -> {
                        if (bmp != null) holder.logo.setImageBitmap(bmp);
                    });
                } catch (Exception e) {
                    // Ignore — keep default icon
                }
            }).start();
        }

        holder.itemView.setOnClickListener(v -> clickListener.onChannelClick(ch));
        holder.fav.setOnClickListener(v -> favListener.onFavoriteToggle(ch));
    }

    @Override
    public int getItemCount() {
        return channels.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView logo;
        TextView name;
        TextView group;
        TextView quality;
        TextView vod;
        TextView fav;

        ViewHolder(View view) {
            super(view);
            logo = view.findViewById(R.id.channelLogo);
            name = view.findViewById(R.id.channelName);
            group = view.findViewById(R.id.channelGroup);
            quality = view.findViewById(R.id.channelQuality);
            vod = view.findViewById(R.id.channelVod);
            fav = view.findViewById(R.id.favButton);
        }
    }
}
