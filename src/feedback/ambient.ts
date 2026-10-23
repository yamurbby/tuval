// Ortam sesi: oyun sırasında hafif, döngüsel arka plan (salon / yağmur).
// Sesler tools/ambient.py ile sentezlenir; hatalar sessizce yutulur.
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { AmbientKind } from '../storage/persist';

const SOURCES: Record<Exclude<AmbientKind, 'off'>, number> = {
  rain: require('../../assets/sounds/ambient-rain.wav'),
  fire: require('../../assets/sounds/ambient-fire.wav'),
  piano: require('../../assets/sounds/ambient-piano.wav'),
};
const VOLUME = 0.32;

let current: { kind: AmbientKind; player: AudioPlayer } | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;

function fadeTo(p: AudioPlayer, target: number, ms: number, done?: () => void) {
  if (fadeTimer) clearInterval(fadeTimer);
  const steps = Math.max(1, Math.round(ms / 50));
  const start = p.volume ?? 0;
  let i = 0;
  fadeTimer = setInterval(() => {
    i += 1;
    try {
      p.volume = start + ((target - start) * i) / steps;
    } catch {
      // yoksay
    }
    if (i >= steps) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      done?.();
    }
  }, 50);
}

function release() {
  if (!current) return;
  const p = current.player;
  current = null;
  try {
    p.pause();
    p.remove();
  } catch {
    // yoksay
  }
}

/** Ortam sesini başlatır / değiştirir. 'off' durdurur. */
export function setAmbient(kind: AmbientKind) {
  if (current?.kind === kind) {
    try {
      if (!current.player.playing) current.player.play();
    } catch {
      // yoksay
    }
    return;
  }
  stopAmbient(true);
  if (kind === 'off') return;
  try {
    const player = createAudioPlayer(SOURCES[kind]);
    player.loop = true;
    player.volume = 0;
    player.play();
    current = { kind, player };
    fadeTo(player, VOLUME, 1200);
  } catch {
    current = null;
  }
}

export function pauseAmbient() {
  try {
    current?.player.pause();
  } catch {
    // yoksay
  }
}

export function stopAmbient(immediate = false) {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = null;
  if (!current) return;
  if (immediate) return release();
  const p = current.player;
  fadeTo(p, 0, 600, () => {
    if (current?.player === p) release();
  });
}

/** Ayarlarda seçince birkaç saniyelik önizleme */
export function previewAmbient(kind: AmbientKind) {
  setAmbient(kind);
  if (kind === 'off') return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => stopAmbient(), 4000);
}
