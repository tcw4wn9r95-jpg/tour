// Procedural background music: soft pads, a gentle arpeggio and bass in a
// mood-dependent key and tempo, played through a small reverb. Generated with
// the Web Audio API, so there are no music files or licences to worry about,
// and it works both live and inside an OfflineAudioContext.
import type { Mood } from "../types";

interface MoodSpec {
  bpm: number;
  root: number; // MIDI note of the key's tonic (octave used for pads)
  chords: number[][]; // semitone offsets from the root, one chord per 2 bars
  pad: OscillatorType;
  padCutoff: number;
  pluck: OscillatorType;
  pluckDecay: number;
  arp: number[]; // indices into the chord (+1 octave), one per step
  stepsPerBeat: number;
  perc: boolean;
  level: number;
}

const MAJ = { I: [0, 4, 7, 11], ii: [2, 5, 9, 12], iii: [4, 7, 11, 14], IV: [5, 9, 12, 16], V: [7, 11, 14, 17], vi: [9, 12, 16, 19], iv: [5, 8, 12, 15] };
const MIN = { i: [0, 3, 7, 10], III: [3, 7, 10, 14], iv: [5, 8, 12, 15], v: [7, 10, 14, 17], VI: [8, 12, 15, 19], VII: [10, 14, 17, 21] };

const MOODS: Record<Mood, MoodSpec> = {
  warm: { bpm: 78, root: 53, chords: [MAJ.I, MAJ.V, MAJ.vi, MAJ.IV], pad: "triangle", padCutoff: 1400, pluck: "triangle", pluckDecay: 0.9, arp: [0, 1, 2, 3, 2, 1, 0, 2], stepsPerBeat: 2, perc: false, level: 1 },
  majestic: { bpm: 64, root: 50, chords: [MAJ.I, MAJ.IV, MAJ.vi, MAJ.V], pad: "sawtooth", padCutoff: 1100, pluck: "triangle", pluckDecay: 1.6, arp: [0, 2, 3, 2], stepsPerBeat: 1, perc: false, level: 0.9 },
  lively: { bpm: 104, root: 55, chords: [MAJ.I, MAJ.vi, MAJ.ii, MAJ.V], pad: "triangle", padCutoff: 1800, pluck: "triangle", pluckDecay: 0.45, arp: [0, 2, 1, 3, 2, 1, 3, 2], stepsPerBeat: 2, perc: true, level: 0.9 },
  mellow: { bpm: 70, root: 57, chords: [MIN.i, MIN.VI, MIN.III, MIN.VII], pad: "sine", padCutoff: 1200, pluck: "sine", pluckDecay: 1.4, arp: [0, 2, 3, 1], stepsPerBeat: 1, perc: false, level: 1.2 },
  mysterious: { bpm: 60, root: 50, chords: [MIN.i, MIN.VI, MIN.iv, MIN.v], pad: "sawtooth", padCutoff: 800, pluck: "sine", pluckDecay: 2.2, arp: [3, 0, 2, 1], stepsPerBeat: 1, perc: false, level: 0.9 },
  romantic: { bpm: 72, root: 51, chords: [MAJ.I, MAJ.iii, MAJ.IV, MAJ.iv], pad: "triangle", padCutoff: 1300, pluck: "triangle", pluckDecay: 1.1, arp: [0, 1, 2, 3, 2, 1], stepsPerBeat: 2, perc: false, level: 1 },
};

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

function reverb(ctx: BaseAudioContext, seconds = 2.8): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  const rand = rng(7);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (rand() * 2 - 1) * (1 - i / len) ** 3;
  }
  const node = ctx.createConvolver();
  node.buffer = ir;
  return node;
}

function envGain(ctx: BaseAudioContext, dest: AudioNode, t0: number, attack: number, hold: number, release: number, peak: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.linearRampToValueAtTime(0, t0 + attack + hold + release);
  g.connect(dest);
  return g;
}

/**
 * Schedules `duration` seconds of music starting at `start` into `dest`.
 * Returns the time the music actually ends.
 */
export function scheduleMusic(ctx: BaseAudioContext, dest: AudioNode, mood: Mood, start: number, duration: number, seed = 1): number {
  const spec = MOODS[mood] ?? MOODS.warm;
  const rand = rng(seed);
  const beat = 60 / spec.bpm;
  const chordLen = beat * 8;
  const end = start + duration;

  const bus = ctx.createGain();
  bus.gain.value = spec.level;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 5200;
  const wet = ctx.createGain();
  wet.gain.value = 0.38;
  const verb = reverb(ctx);
  bus.connect(tone);
  tone.connect(dest);
  tone.connect(verb);
  verb.connect(wet);
  wet.connect(dest);

  const panTo = (pan: number, target: AudioNode): AudioNode => {
    if (typeof ctx.createStereoPanner !== "function") return target;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(target);
    return p;
  };
  const left = panTo(-0.35, bus);
  const right = panTo(0.35, bus);

  let chordIndex = 0;
  for (let t = start; t < end; t += chordLen, chordIndex++) {
    const chord = spec.chords[chordIndex % spec.chords.length];
    const len = Math.min(chordLen, end - t);

    // Pad: each chord tone as two slightly detuned oscillators, spread in stereo.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.setValueAtTime(spec.padCutoff * 0.7, t);
    padFilter.frequency.linearRampToValueAtTime(spec.padCutoff, t + len / 2);
    padFilter.frequency.linearRampToValueAtTime(spec.padCutoff * 0.7, t + len);
    padFilter.connect(bus);
    const padPeak = spec.pad === "sawtooth" ? 0.022 : 0.04;
    const padLeft = panTo(-0.45, padFilter);
    const padRight = panTo(0.45, padFilter);
    for (const offset of chord.slice(0, 3)) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = spec.pad;
        osc.frequency.value = midiHz(spec.root + offset);
        osc.detune.value = detune;
        const g = envGain(ctx, detune < 0 ? padLeft : padRight, t, Math.min(1.4, len / 3), Math.max(0, len - 1.4), 1.4, padPeak);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + len + 1.5);
      }
    }

    // Bass: chord root an octave down, on beats 1 and 5 of the chord.
    for (const b of [0, 4]) {
      const bt = t + b * beat;
      if (bt >= end) continue;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = midiHz(spec.root + chord[0] - 12);
      const g = envGain(ctx, bus, bt, 0.03, beat * 2.5, beat * 1.2, 0.09);
      osc.connect(g);
      osc.start(bt);
      osc.stop(bt + beat * 4);
    }

    // Arpeggio: plucked chord tones an octave up with light humanisation.
    const steps = Math.floor((len / beat) * spec.stepsPerBeat);
    for (let s = 0; s < steps; s++) {
      const st = Math.max(start, t + (s * beat) / spec.stepsPerBeat + (rand() - 0.5) * 0.012);
      if (st >= end - 0.2) break;
      if (rand() < 0.12) continue; // leave some air
      const note = spec.root + 12 + chord[spec.arp[s % spec.arp.length] % chord.length];
      const osc = ctx.createOscillator();
      osc.type = spec.pluck;
      osc.frequency.value = midiHz(note);
      const g = ctx.createGain();
      const peak = (spec.pluck === "sine" ? 0.07 : 0.05) * (0.75 + rand() * 0.4);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(peak, st + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, st + spec.pluckDecay);
      g.connect(s % 2 ? left : right);
      osc.connect(g);
      osc.start(st);
      osc.stop(st + spec.pluckDecay + 0.05);
    }

    // Light percussion for upbeat moods: soft kick + offbeat shaker.
    if (spec.perc) {
      const noise = noiseBuffer(ctx);
      for (let b = 0; b < 8; b++) {
        const bt = t + b * beat;
        if (bt >= end - 0.2) break;
        if (b % 2 === 0) {
          const k = ctx.createOscillator();
          k.frequency.setValueAtTime(110, bt);
          k.frequency.exponentialRampToValueAtTime(45, bt + 0.12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.12, bt);
          g.gain.exponentialRampToValueAtTime(0.0001, bt + 0.25);
          k.connect(g);
          g.connect(bus);
          k.start(bt);
          k.stop(bt + 0.3);
        }
        const sh = ctx.createBufferSource();
        sh.buffer = noise;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 7000;
        const g = ctx.createGain();
        const at = bt + beat / 2;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.035, at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
        sh.connect(hp);
        hp.connect(g);
        g.connect(right);
        sh.start(at);
      }
    }
  }
  return end;
}

let noiseCache: WeakMap<BaseAudioContext, AudioBuffer> | null = null;
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  noiseCache ??= new WeakMap();
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const d = buf.getChannelData(0);
    const rand = rng(99);
    for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}
