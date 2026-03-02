import { useCallback, useEffect, useRef, useState } from "react";

const MUSIC_STORAGE_KEY = "game_music_muted";

/**
 * Procedural 8-bit chiptune loop using Web Audio API.
 * Generates a retro, fun melody that loops seamlessly.
 */
class ChiptunePlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private loopTimeout: ReturnType<typeof setTimeout> | null = null;
  private oscillators: OscillatorNode[] = [];
  private volume = 0.08; // Keep it subtle

  // C major pentatonic melody notes (frequencies in Hz)
  private melodyNotes = [
    523, 587, 659, 784, 880, // C5, D5, E5, G5, A5
    784, 659, 587, 523, 440, // G5, E5, D5, C5, A4
    523, 659, 784, 880, 1047, // C5, E5, G5, A5, C6
    880, 784, 659, 523, 440, // A5, G5, E5, C5, A4
  ];

  // Bass line (lower octave)
  private bassNotes = [
    131, 131, 165, 165, // C3, C3, E3, E3
    196, 196, 220, 220, // G3, G3, A3, A3
    131, 131, 165, 165,
    196, 196, 220, 131,
  ];

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playNote(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = "square",
    vol = 1
  ) {
    const ctx = this.getCtx();
    if (!this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(vol * 0.6, startTime);
    gain.gain.setValueAtTime(vol * 0.6, startTime + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.oscillators.push(osc);
    osc.onended = () => {
      this.oscillators = this.oscillators.filter((o) => o !== osc);
    };
  }

  private playLoop() {
    if (!this.isPlaying) return;

    const ctx = this.getCtx();
    const now = ctx.currentTime + 0.05;
    const tempo = 0.22; // seconds per note
    const totalNotes = this.melodyNotes.length;

    // Play melody
    for (let i = 0; i < totalNotes; i++) {
      this.playNote(this.melodyNotes[i], now + i * tempo, tempo * 0.85, "square", 0.5);
    }

    // Play bass (every 2 melody notes)
    for (let i = 0; i < this.bassNotes.length; i++) {
      this.playNote(
        this.bassNotes[i],
        now + i * tempo * (totalNotes / this.bassNotes.length),
        tempo * (totalNotes / this.bassNotes.length) * 0.9,
        "triangle",
        0.8
      );
    }

    // Simple percussion (noise bursts on beats)
    for (let i = 0; i < totalNotes; i += 2) {
      this.playPercussion(now + i * tempo, tempo * 0.15);
    }

    // Schedule next loop
    const loopDuration = totalNotes * tempo;
    this.loopTimeout = setTimeout(() => {
      this.playLoop();
    }, loopDuration * 1000 - 50); // slight overlap for seamlessness
  }

  private playPercussion(startTime: number, duration: number) {
    const ctx = this.getCtx();
    if (!this.masterGain) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    source.connect(gain);
    gain.connect(this.masterGain!);
    source.start(startTime);
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playLoop();
  }

  stop() {
    this.isPlaying = false;
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    // Fade out existing oscillators
    this.oscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
    });
    this.oscillators = [];
  }

  setVolume(vol: number) {
    this.volume = vol;
    if (this.masterGain) {
      this.masterGain.gain.value = vol;
    }
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

// Singleton player instance
const musicPlayer = new ChiptunePlayer();

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

  // Cleanup on unmount
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
