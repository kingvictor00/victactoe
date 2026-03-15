import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "game_sounds_muted";

// Web Audio API-based sound generator - no external files needed
class SoundGenerator {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.5) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume = 0.2) {
    const ctx = this.getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  markPlace() {
    this.playTone(880, 0.1, "sine", 0.12);
    setTimeout(() => this.playTone(1100, 0.08, "sine", 0.08), 50);
  }

  bidPlace() {
    this.playTone(523, 0.08, "triangle", 0.1);
    setTimeout(() => this.playTone(659, 0.08, "triangle", 0.1), 80);
    setTimeout(() => this.playTone(784, 0.1, "triangle", 0.1), 160);
  }

  turnChange() {
    this.playTone(440, 0.12, "sine", 0.08);
    setTimeout(() => this.playTone(554, 0.1, "sine", 0.06), 100);
  }

  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, "sine", 0.12), i * 120);
    });
  }

  lose() {
    this.playTone(440, 0.3, "sawtooth", 0.06);
    setTimeout(() => this.playTone(370, 0.4, "sawtooth", 0.05), 200);
  }

  roundStart() {
    this.playTone(660, 0.1, "square", 0.06);
    setTimeout(() => this.playTone(880, 0.15, "square", 0.08), 120);
  }

  tournamentVictory() {
    const notes = [523, 659, 784, 880, 1047, 1319, 1568];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.25, "sine", 0.1 + i * 0.01), i * 100);
    });
    setTimeout(() => this.playNoise(0.3, 0.04), 700);
  }
}

const generator = new SoundGenerator();

export function useGameSounds() {
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const play = useCallback((sound: keyof Omit<SoundGenerator, never>) => {
    if (isMutedRef.current) return;
    try {
      (generator as any)[sound]();
    } catch {}
  }, []);

  return { isMuted, toggleMute, play };
}
