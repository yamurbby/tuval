// Ses ve titreşim geri bildirimi — bilinçli olarak hafif. Yanlış yerleştirme sessizdir.
// Hatalar sessizce yutulur: geri bildirim hiçbir zaman oyunu kesmemeli.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type SoundName = 'snap' | 'merge' | 'win';
const SOURCES: Record<SoundName, number> = {
  snap: require('../../assets/sounds/snap.wav'),
  merge: require('../../assets/sounds/merge.wav'),
  win: require('../../assets/sounds/win.wav'),
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let modeSet = false;

function player(name: SoundName): AudioPlayer | null {
  try {
    if (!modeSet) {
      modeSet = true;
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
    return players[name] ?? null;
  } catch {
    return null;
  }
}

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled) return;
  const p = player(name);
  if (!p) return;
  try {
    p.volume = name === 'win' ? 0.5 : 0.4;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // yoksay
  }
}

export function haptic(kind: 'pick' | 'snap' | 'merge' | 'win', enabled: boolean) {
  if (!enabled) return;
  if (Platform.OS === 'web') {
    // PWA / Android uygulama paketi (TWA) içinde titreşim: navigator.vibrate
    try {
      const ms = kind === 'pick' ? 8 : kind === 'win' ? [20, 60, 30] : 14;
      (globalThis as any).navigator?.vibrate?.(ms);
    } catch {
      // yoksay
    }
    return;
  }
  try {
    if (kind === 'pick') Haptics.selectionAsync().catch(() => {});
    else if (kind === 'win') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  } catch {
    // yoksay
  }
}

export function preloadSounds() {
  (Object.keys(SOURCES) as SoundName[]).forEach((n) => player(n));
}
