"use client";
// One shared audio player for the whole app. iOS only allows audio that was
// started from a tap, so `play()` does its unlocking synchronously and then
// fetches / mixes the narration asynchronously.
import { useSyncExternalStore } from "react";
import { BASE, fetchSpeech, loadConfig, onConfigChange } from "../client/api";
import { getVoice, hashText, putVoice } from "../client/store";
import type { Narration } from "../types";
import { decodeVoice, encodeWav, renderEpisode } from "./mixer";
import { scheduleMusic } from "./music";

export interface Track {
  id: string;
  title: string;
  subtitle: string;
  narration: Narration;
  artwork?: string;
  href?: string;
}

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface PlayerState {
  track: Track | null;
  status: PlayerStatus;
  position: number;
  duration: number;
  mode: "audio" | "speech";
  error?: string;
}

// 50 ms of silence, used to unlock the <audio> element inside the tap handler.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

type TtsMode = "elevenlabs" | "openai" | "browser";

class Player {
  private state: PlayerState = { track: null, status: "idle", position: 0, duration: 0, mode: "audio" };
  private listeners = new Set<() => void>();
  private audio: HTMLAudioElement | null = null;
  private rendered = new Map<string, string>();
  private token = 0;
  /** null until /api/config answers; we then try the server voice first. */
  private ttsMode: TtsMode | null = null;
  private speech: { ctx: AudioContext; music: GainNode; timer: number; started: number; paused: number; estimate: number } | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    onConfigChange((c) => (this.ttsMode = c.tts));
    loadConfig().catch(() => {});
    window.speechSynthesis?.getVoices();
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getState = () => this.state;

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = "auto";
    a.addEventListener("timeupdate", () => {
      if (a.src.startsWith("blob:")) this.set({ position: a.currentTime, duration: a.duration || this.state.duration });
    });
    a.addEventListener("play", () => a.src.startsWith("blob:") && this.set({ status: "playing" }));
    a.addEventListener("pause", () => a.src.startsWith("blob:") && this.state.status === "playing" && this.set({ status: "paused" }));
    a.addEventListener("ended", () => a.src.startsWith("blob:") && this.set({ status: "ended", position: a.duration }));
    this.audio = a;
    this.setupMediaSession();
    return a;
  }

  private setupMediaSession() {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => this.resume()],
      ["pause", () => this.pause()],
      ["seekbackward", () => this.skip(-10)],
      ["seekforward", () => this.skip(10)],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* action not supported on this browser */
      }
    }
  }

  isCurrent(id: string) {
    return this.state.track?.id === id;
  }

  /** Call directly from a tap/click handler. */
  play(track: Track) {
    const token = ++this.token;
    this.stopSpeech();
    const audio = this.ensureAudio();
    const key = `${track.narration.mood}:${hashText(track.narration.script)}`;
    this.set({ track, status: "loading", position: 0, duration: 0, error: undefined, mode: "audio" });

    if (this.ttsMode === "browser") {
      audio.pause();
      this.playSpeech(track);
      return;
    }

    const ready = this.rendered.get(key);
    if (ready) {
      audio.src = ready;
      void audio.play().catch((e) => this.fail(e));
      this.updateMediaMetadata(track);
      return;
    }
    // Unlock both the audio element and speech synthesis while we're still in the tap.
    audio.src = SILENT_WAV;
    void audio.play().catch(() => {});
    this.primeSpeech();

    this.render(track, key).then(
      (url) => {
        if (token !== this.token) return;
        audio.src = url;
        this.updateMediaMetadata(track);
        // If the browser refuses to start without a fresh tap, wait for one.
        audio.play().catch(() => token === this.token && this.set({ status: "paused" }));
      },
      (err) => {
        if (token !== this.token) return;
        console.warn("Narration audio unavailable, using the device voice", err);
        audio.pause();
        this.playSpeech(track);
      },
    );
  }

  toggle(track: Track) {
    if (this.isCurrent(track.id)) {
      if (this.state.status === "playing") return this.pause();
      if (this.state.status === "paused") return this.resume();
      if (this.state.status === "loading") return;
      if (this.state.status === "ended") return this.resume();
    }
    this.play(track);
  }

  pause() {
    if (this.state.mode === "speech" && this.speech) {
      window.speechSynthesis.pause();
      void this.speech.ctx.suspend();
      this.speech.paused = performance.now();
      this.set({ status: "paused" });
      return;
    }
    this.audio?.pause();
  }

  resume() {
    if (this.state.mode === "speech" && this.speech) {
      window.speechSynthesis.resume();
      void this.speech.ctx.resume();
      this.speech.started += performance.now() - this.speech.paused;
      this.set({ status: "playing" });
      return;
    }
    if (this.state.status === "ended" && this.state.track) return this.play(this.state.track);
    void this.audio?.play().catch((e) => this.fail(e));
  }

  skip(seconds: number) {
    if (!this.audio || this.state.mode !== "audio" || !this.audio.duration) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration - 0.1, this.audio.currentTime + seconds));
  }

  seek(fraction: number) {
    if (!this.audio || this.state.mode !== "audio" || !this.audio.duration) return;
    this.audio.currentTime = fraction * this.audio.duration;
  }

  stop() {
    this.token++;
    this.stopSpeech();
    this.audio?.pause();
    this.set({ track: null, status: "idle", position: 0, duration: 0 });
  }

  private fail(err: unknown) {
    console.warn(err);
    this.set({ status: "error", error: "Couldn't play the audio. Tap to try again." });
  }

  private async render(track: Track, key: string): Promise<string> {
    const mode = this.ttsMode ?? (await loadConfig().then((c) => c.tts, () => "server"));
    const voiceKey = `${mode}:${hashText(track.narration.script)}`;
    let mp3 = await getVoice(voiceKey);
    if (!mp3) {
      mp3 = await fetchSpeech(track.narration.script);
      void putVoice(voiceKey, mp3);
    }
    const voice = await decodeVoice(await mp3.arrayBuffer());
    const mixed = await renderEpisode(voice, track.narration.mood, parseInt(hashText(track.id), 16) || 1);
    const url = URL.createObjectURL(encodeWav(mixed));
    this.rendered.set(key, url);
    // Keep only a few mixed episodes in memory.
    for (const [k, u] of this.rendered) {
      if (this.rendered.size <= 4) break;
      if (u !== this.audio?.src) {
        URL.revokeObjectURL(u);
        this.rendered.delete(k);
      }
    }
    return url;
  }

  private updateMediaMetadata(track: Track) {
    if (typeof MediaMetadata === "undefined" || !navigator.mediaSession) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: "Your tour guide",
      album: track.subtitle,
      artwork: track.artwork ? [{ src: track.artwork, sizes: "512x512" }] : [{ src: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png" }],
    });
  }

  // --- Device voice fallback (no TTS key configured) ---------------------------

  private primeSpeech() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth.speak(u);
  }

  private playSpeech(track: Track) {
    const synth = window.speechSynthesis;
    if (!synth) {
      this.set({ status: "error", error: "This device can't play the narration." });
      return;
    }
    synth.cancel();
    const script = track.narration.script;
    const utter = new SpeechSynthesisUtterance(script);
    const voice = pickEnglishVoice();
    if (voice) utter.voice = voice;
    utter.lang = voice?.lang ?? "en-US";
    utter.rate = 0.96;
    const estimate = script.split(/\s+/).length / 2.5 / utter.rate;

    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const music = ctx.createGain();
    music.connect(ctx.destination);
    try {
      const now = ctx.currentTime;
      music.gain.setValueAtTime(0, now);
      music.gain.linearRampToValueAtTime(0.2, now + 1.2);
      scheduleMusic(ctx, music, track.narration.mood, now, estimate * 1.5 + 15, parseInt(hashText(track.id), 16) || 1);
    } catch (err) {
      console.warn("Background music unavailable", err); // the narration still plays
    }

    const started = performance.now();
    const timer = window.setInterval(() => {
      if (!this.speech || this.state.status !== "playing") return;
      const pos = Math.min(estimate, (performance.now() - this.speech.started) / 1000);
      this.set({ position: pos });
    }, 250);
    this.speech = { ctx, music, timer, started, paused: 0, estimate };
    this.set({ mode: "speech", status: "playing", duration: estimate, position: 0 });

    utter.onend = () => {
      if (this.speech?.ctx !== ctx) return;
      const t = ctx.currentTime;
      music.gain.cancelScheduledValues(t);
      music.gain.setValueAtTime(music.gain.value, t);
      music.gain.linearRampToValueAtTime(0.8, t + 1);
      music.gain.linearRampToValueAtTime(0, t + 5);
      window.setTimeout(() => this.speech?.ctx === ctx && this.stopSpeech(), 5200);
      this.set({ status: "ended", position: estimate });
    };
    utter.onerror = () => {
      if (this.speech?.ctx === ctx) this.stopSpeech();
    };
    synth.speak(utter);
  }

  private stopSpeech() {
    if (!this.speech) return;
    window.clearInterval(this.speech.timer);
    window.speechSynthesis?.cancel();
    void this.speech.ctx.close().catch(() => {});
    this.speech = null;
  }
}

const PREFERRED_VOICES = ["Samantha", "Daniel", "Karen", "Moira", "Serena", "Ava", "Evan", "Zoe", "Nathan", "Google UK English", "Google US English"];

function pickEnglishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (/premium|enhanced|neural|natural/i.test(v.name)) s += 10;
    const idx = PREFERRED_VOICES.findIndex((p) => v.name.includes(p));
    if (idx >= 0) s += 8 - idx * 0.3;
    if (v.localService) s += 1;
    if (/en[-_](US|GB)/i.test(v.lang)) s += 1;
    return s;
  };
  return voices.sort((a, b) => score(b) - score(a))[0];
}

let player: Player | null = null;
export function getPlayer(): Player {
  player ??= new Player();
  return player;
}

const SERVER_STATE: PlayerState = { track: null, status: "idle", position: 0, duration: 0, mode: "audio" };

export function usePlayer(): PlayerState {
  return useSyncExternalStore(
    (l) => getPlayer().subscribe(l),
    () => getPlayer().getState(),
    () => SERVER_STATE,
  );
}

/** Downloads every narration's voice so the tour works offline. */
export async function prefetchVoices(scripts: string[], onProgress: (done: number, total: number) => void): Promise<void> {
  const cfg = await loadConfig();
  if (cfg.tts === "browser") return;
  let done = 0;
  for (const script of scripts) {
    const key = `${cfg.tts}:${hashText(script)}`;
    if (!(await getVoice(key))) {
      await putVoice(key, await fetchSpeech(script));
    }
    onProgress(++done, scripts.length);
  }
}
