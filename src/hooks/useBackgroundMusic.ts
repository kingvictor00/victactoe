import { useCallback, useEffect, useRef, useState } from "react";

const MUSIC_STORAGE_KEY = "game_music_muted";
const MUSIC_SRC = "/music/chibi-ninja.mp3";

/**
 * Background music player using an HTML5 Audio element.
 * Plays a looping 8-bit chiptune track (CC-BY Eric Skiff).
 */
class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private isPlaying = false;

  private getAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio(MUSIC_SRC);
      this.audio.loop = true;
      this.audio.volume = 0.15;
    }
    return this.audio;
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const audio = this.getAudio();
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

  getIsPlaying() {
    return this.isPlaying;
  }
}

// Singleton
const musicPlayer = new MusicPlayer();

export function useBackgroundMusic() {
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
      musicPlayer.start();
    }
  }, [isMusicMuted]);

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
