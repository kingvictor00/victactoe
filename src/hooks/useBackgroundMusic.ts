import { useCallback, useEffect, useRef, useState } from "react";

const MUSIC_STORAGE_KEY = "game_music_muted";

export type MusicTrack = "default" | "leaderboard";

const TRACKS: Record<MusicTrack, string> = {
  default: "/music/chibi-ninja.mp3",
  leaderboard: "/music/soft-meditation.mp3",
};

/**
 * Background music player. Supports switching between tracks (e.g. gameplay
 * vs. leaderboard) while preserving mute state across the app.
 */
class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private isPlaying = false;
  private currentTrack: MusicTrack = "default";

  private getAudio(track: MusicTrack): HTMLAudioElement {
    if (this.audio && this.currentTrack !== track) {
      this.audio.pause();
      this.audio = null;
    }
    if (!this.audio) {
      this.audio = new Audio(TRACKS[track]);
      this.audio.loop = true;
      this.audio.volume = 0.15;
      this.currentTrack = track;
    }
    return this.audio;
  }

  start(track: MusicTrack = "default") {
    const sameTrack = this.isPlaying && this.currentTrack === track;
    if (sameTrack) return;
    this.isPlaying = true;
    const audio = this.getAudio(track);
    audio.play().catch(() => {
      // Autoplay blocked — will retry on next user interaction
    });
  }

  stop() {
    this.isPlaying = false;
    if (this.audio) {
      this.audio.pause();
    }
  }

  getCurrentTrack(): MusicTrack {
    return this.currentTrack;
  }
}

// Singleton
const musicPlayer = new MusicPlayer();

export function useBackgroundMusic(track: MusicTrack = "default") {
  const [isMusicMuted, setIsMusicMuted] = useState(() => {
    try {
      return localStorage.getItem(MUSIC_STORAGE_KEY) !== "false"; // muted by default
    } catch {
      return true;
    }
  });

  const isMutedRef = useRef(isMusicMuted);

  useEffect(() => {
    isMutedRef.current = isMusicMuted;
    if (isMusicMuted) {
      musicPlayer.stop();
    } else {
      musicPlayer.start(track);
    }
  }, [isMusicMuted, track]);

  useEffect(() => {
    return () => {
      musicPlayer.stop();
    };
  }, []);

  const toggleMusic = useCallback(() => {
    setIsMusicMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUSIC_STORAGE_KEY, String(!next));
      } catch {}
      return next;
    });
  }, []);

  return { isMusicMuted, toggleMusic };
}
