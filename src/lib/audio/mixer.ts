// Mixes a narration voice track with generated background music into one
// finished "mini podcast": music intro, voice with the music ducked
// underneath, a short musical outro. Rendered offline in well under a second.
import type { Mood } from "../types";
import { scheduleMusic } from "./music";

export const INTRO_S = 3.5;
export const OUTRO_S = 5;
const SAMPLE_RATE = 44100;
const DUCKED = 0.25; // ~16 dB under a typical TTS voice: audible, never competing

export async function decodeVoice(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, SAMPLE_RATE, SAMPLE_RATE);
  return ctx.decodeAudioData(data);
}

export async function renderEpisode(voice: AudioBuffer, mood: Mood, seed: number): Promise<AudioBuffer> {
  const total = INTRO_S + voice.duration + OUTRO_S;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * SAMPLE_RATE), SAMPLE_RATE);

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16;
  glue.ratio.value = 3;
  glue.attack.value = 0.01;
  glue.release.value = 0.25;
  glue.connect(ctx.destination);

  const music = ctx.createGain();
  music.connect(glue);
  const vStart = INTRO_S;
  const vEnd = INTRO_S + voice.duration;
  const g = music.gain;
  g.setValueAtTime(0, 0);
  g.linearRampToValueAtTime(1, 1.2);
  g.setValueAtTime(1, vStart - 0.7);
  g.linearRampToValueAtTime(DUCKED, vStart + 0.1);
  g.setValueAtTime(DUCKED, vEnd - 0.1);
  g.linearRampToValueAtTime(0.9, vEnd + 1);
  g.setValueAtTime(0.9, total - 3.2);
  g.linearRampToValueAtTime(0, total);
  scheduleMusic(ctx, music, mood, 0, total, seed);

  const src = ctx.createBufferSource();
  src.buffer = voice;
  const vg = ctx.createGain();
  vg.gain.value = 0.95;
  src.connect(vg);
  vg.connect(glue);
  src.start(vStart);

  return ctx.startRendering();
}

/** 16-bit PCM WAV so iOS can play it in a normal <audio> element (lock screen, AirPods, CarPlay). */
export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}
