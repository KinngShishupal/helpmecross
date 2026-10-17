/* eslint-env node */
/**
 * Synthesises all sound effects and the background music loop as 16-bit mono
 * WAV files into android/app/src/main/res/raw. Run with:
 *   node scripts/generate-audio.js
 */
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw');
fs.mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const noiseRand = rng(99);

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function buffer(seconds) {
  return new Float32Array(Math.ceil(seconds * RATE));
}

const WAVES = {
  sine: p => Math.sin(2 * Math.PI * p),
  triangle: p => 1 - 4 * Math.abs((p % 1) - 0.5),
  square: p => ((p % 1) < 0.5 ? 1 : -1),
  saw: p => 2 * (p % 1) - 1,
};

/**
 * Adds a tone to `buf`. Frequency may glide from `freq` to `to`.
 * Envelope: linear attack, then exponential decay with time constant `decay`.
 */
function tone(buf, { at = 0, dur, freq, to = freq, wave = 'sine', vol = 0.5, attack = 0.005, decay = dur, release = 0.02, vibrato = 0, harmonics = [] }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(dur * RATE);
  let phase = 0;
  const hPhase = harmonics.map(() => 0);
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    const f = (freq + (to - freq) * (i / n)) * (1 + vibrato * Math.sin(2 * Math.PI * 5.5 * t));
    phase += f / RATE;
    let v = WAVES[wave](phase);
    harmonics.forEach(([mult, amp, hDecay], k) => {
      hPhase[k] += (f * mult) / RATE;
      v += amp * Math.sin(2 * Math.PI * hPhase[k]) * Math.exp(-t / hDecay);
    });
    let env = t < attack ? t / attack : Math.exp(-(t - attack) / decay);
    const tailStart = dur - release;
    if (t > tailStart) {
      env *= Math.max(0, (dur - t) / release);
    }
    buf[start + i] += v * env * vol;
  }
}

/** Filtered noise burst. `lp` is a one-pole low-pass coefficient (0..1). */
function noise(buf, { at = 0, dur, vol = 0.3, attack = 0.01, decay = dur, lp = 0.2, hp = 0 }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(dur * RATE);
  let low = 0;
  let prevLow = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    low += lp * (noiseRand() * 2 - 1 - low);
    const v = hp ? low - prevLow * (1 - hp) : low;
    prevLow = low;
    const env = (t < attack ? t / attack : Math.exp(-(t - attack) / decay)) * Math.min(1, (dur - t) / 0.01);
    buf[start + i] += v * env * vol;
  }
}

function writeWav(name, buf, peak = 0.9) {
  let max = 0;
  for (const v of buf) {
    max = Math.max(max, Math.abs(v));
  }
  const gain = max > 0 ? peak / max : 1;
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([header, data]));
}

// ------------------------------------------------------------------ sfx --

function sfx() {
  let b = buffer(0.08);
  tone(b, { dur: 0.08, freq: 2400, to: 1800, vol: 0.4, decay: 0.015 });
  writeWav('sfx_click', b, 0.5);

  b = buffer(0.22);
  tone(b, { dur: 0.22, freq: 380, to: 760, vol: 0.6, decay: 0.07, harmonics: [[2, 0.3, 0.03]] });
  tone(b, { at: 0.03, dur: 0.15, freq: 1200, to: 1500, vol: 0.12, decay: 0.03 });
  writeWav('sfx_board', b, 0.8);

  b = buffer(0.22);
  tone(b, { dur: 0.22, freq: 700, to: 340, vol: 0.6, decay: 0.07, harmonics: [[2, 0.3, 0.03]] });
  writeWav('sfx_unboard', b, 0.7);

  b = buffer(1.25);
  [0, 0.38, 0.76].forEach(at => {
    noise(b, { at, dur: 0.34, vol: 0.9, attack: 0.08, decay: 0.12, lp: 0.12 });
    tone(b, { at: at + 0.06, dur: 0.2, freq: 190, to: 120, vol: 0.35, decay: 0.06 });
  });
  const bubbles = rng(5);
  for (let i = 0; i < 14; i++) {
    const at = bubbles() * 1.1;
    const f = 700 + bubbles() * 900;
    tone(b, { at, dur: 0.06, freq: f, to: f * 1.6, vol: 0.06, decay: 0.02 });
  }
  writeWav('sfx_row', b, 0.75);

  // footsteps on creaky wooden planks
  b = buffer(1.3);
  for (let i = 0; i < 6; i++) {
    const at = i * 0.2;
    tone(b, { at, dur: 0.12, freq: 120, to: 70, vol: 0.55, decay: 0.035 });
    noise(b, { at, dur: 0.05, vol: 0.25, decay: 0.012, lp: 0.35 });
    if (i % 2 === 0) {
      tone(b, { at: at + 0.03, dur: 0.16, freq: 340, to: 300, wave: 'triangle', vol: 0.06, decay: 0.08, vibrato: 0.03 });
    }
  }
  writeWav('sfx_walk', b, 0.7);

  b = buffer(0.3);
  tone(b, { dur: 0.3, freq: 150, to: 70, vol: 0.8, decay: 0.07 });
  noise(b, { dur: 0.05, vol: 0.4, decay: 0.012, lp: 0.5 });
  writeWav('sfx_arrive', b, 0.8);

  b = buffer(0.32);
  tone(b, { dur: 0.13, freq: 233, wave: 'square', vol: 0.18, decay: 0.08 });
  tone(b, { at: 0.15, dur: 0.16, freq: 196, wave: 'square', vol: 0.18, decay: 0.1 });
  writeWav('sfx_error', b, 0.55);

  b = buffer(2.2);
  [72, 76, 79, 84].forEach((n, i) => {
    tone(b, { at: i * 0.11, dur: 0.6, freq: midi(n), vol: 0.5, decay: 0.22, harmonics: [[3, 0.25, 0.05], [4, 0.1, 0.03]] });
  });
  [72, 76, 79, 84, 88].forEach(n => {
    tone(b, { at: 0.5, dur: 1.6, freq: midi(n), wave: 'triangle', vol: 0.18, attack: 0.02, decay: 0.7, vibrato: 0.004 });
  });
  for (let i = 0; i < 10; i++) {
    tone(b, { at: 0.55 + i * 0.09, dur: 0.15, freq: midi(96 + ((i * 5) % 12)), vol: 0.06, decay: 0.04 });
  }
  writeWav('sfx_win', b, 0.85);

  b = buffer(1.9);
  [[67, 66], [65, 64], [63, 62]].forEach(([a, z], i) => {
    tone(b, { at: i * 0.32, dur: 0.3, freq: midi(a), to: midi(z), wave: 'triangle', vol: 0.45, attack: 0.02, decay: 0.3, harmonics: [[2, 0.2, 0.2]] });
  });
  tone(b, { at: 0.96, dur: 0.9, freq: midi(61), to: midi(59), wave: 'triangle', vol: 0.45, attack: 0.02, decay: 0.6, vibrato: 0.02, harmonics: [[2, 0.2, 0.4]] });
  noise(b, { at: 0.02, dur: 0.4, vol: 0.25, decay: 0.15, lp: 0.08 });
  writeWav('sfx_lose', b, 0.8);
}

// ---------------------------------------------------------------- music --

function music() {
  const bpm = 104;
  const beat = 60 / bpm;
  const bars = 16;
  const loop = bars * 4 * beat;
  const b = buffer(loop + 3);
  // C, Am, F, G | C, Am, F, G | F, G, Em, Am | F, G, C, C
  const chords = [
    [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
    [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
    [53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64],
    [53, 57, 60], [55, 59, 62], [60, 64, 67], [60, 64, 67],
  ];
  const scale = [0, 2, 4, 7, 9];
  const r = rng(2024);
  const rhythms = [
    [1, 0, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 1, 0, 1, 1, 0],
    [1, 1, 0, 1, 0, 0, 1, 0],
    [1, 0, 1, 0, 1, 0, 1, 1],
  ];
  let lastNote = 76;

  chords.forEach((chord, bar) => {
    const t0 = bar * 4 * beat;
    // pad
    chord.forEach(n => {
      for (const det of [-0.003, 0.003]) {
        tone(b, { at: t0, dur: 4 * beat + 0.3, freq: midi(n) * (1 + det), wave: 'triangle', vol: 0.045, attack: 0.35, decay: 6, release: 0.35 });
      }
    });
    // bass
    for (const k of [0, 2, 2.5]) {
      tone(b, { at: t0 + k * beat, dur: beat * 0.9, freq: midi(chord[0] - 24), vol: k === 2.5 ? 0.16 : 0.26, decay: 0.25, harmonics: [[2, 0.35, 0.1]] });
    }
    // drums: soft kick, rim and shaker
    for (let k = 0; k < 4; k++) {
      if (k % 2 === 0) {
        tone(b, { at: t0 + k * beat, dur: 0.22, freq: 110, to: 45, vol: 0.4, decay: 0.07 });
      } else {
        noise(b, { at: t0 + k * beat, dur: 0.08, vol: 0.12, decay: 0.02, lp: 0.6, hp: 0.4 });
      }
    }
    for (let k = 0; k < 8; k++) {
      noise(b, { at: t0 + k * beat * 0.5, dur: 0.05, vol: k % 2 ? 0.05 : 0.03, decay: 0.015, lp: 0.9, hp: 0.6 });
    }
    // melody: marimba-like plucks walking through the pentatonic scale
    const rhythm = rhythms[bar % 4 === 3 ? 3 : Math.floor(r() * 3)];
    const quiet = bar === 15;
    rhythm.forEach((hit, k) => {
      if (!hit || (quiet && k > 3)) {
        return;
      }
      const candidates = [];
      for (let oct = 60; oct <= 84; oct += 12) {
        scale.forEach(s => candidates.push(oct + s));
      }
      const inChord = candidates.filter(n => chord.some(c => (n - c) % 12 === 0));
      const pool = k === 0 ? inChord : candidates;
      const near = pool.filter(n => Math.abs(n - lastNote) <= 5 && n >= 67 && n <= 84);
      const note = near.length ? near[Math.floor(r() * near.length)] : 76;
      lastNote = note;
      tone(b, { at: t0 + k * beat * 0.5, dur: 0.7, freq: midi(note), vol: 0.17, decay: 0.22, harmonics: [[4, 0.35, 0.03], [10, 0.08, 0.008]] });
    });
  });
  // wrap the tail into the beginning so the loop is seamless
  const loopLen = Math.round(loop * RATE);
  const out = b.slice(0, loopLen);
  for (let i = loopLen; i < b.length; i++) {
    out[i - loopLen] += b[i];
  }
  writeWav('music_theme', out, 0.8);
}

sfx();
music();
console.log(`Audio written to ${OUT}`);
