import { useCallback, useRef } from 'react';
import { usePrefs } from '@/lib/AppContext';

// Use Web Audio API for notification sounds (no external audio files needed)
const SOUNDS = {
  notification: [523.25, 659.25, 783.99], // C5 E5 G5 chord
  critical: [440, 440, 440],               // A4 repeated (urgent)
  success: [523.25, 783.99],               // C5 G5 (positive)
} as const;

type SoundType = keyof typeof SOUNDS;

/**
 * Returns an AudioContext, creating it lazily on first call.
 * Resumes the context if it was suspended (browser auto-play policy).
 */
async function getAudioContext(ref: React.MutableRefObject<AudioContext | null>): Promise<AudioContext> {
  if (!ref.current) {
    ref.current = new AudioContext();
  }
  if (ref.current.state === 'suspended') {
    await ref.current.resume();
  }
  return ref.current;
}

export function useNotificationSound() {
  const { notificationSoundEnabled, notificationVolume } = usePrefs();
  const ctxRef = useRef<AudioContext | null>(null);

  const play = useCallback(async (type: SoundType = 'notification') => {
    if (!notificationSoundEnabled || notificationVolume <= 0) return;

    try {
      const ctx = await getAudioContext(ctxRef);
      const notes = SOUNDS[type];
      const gain = ctx.createGain();
      gain.gain.value = notificationVolume * 0.3;
      gain.connect(ctx.destination);

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        const start = ctx.currentTime + i * 0.12;
        osc.start(start);
        osc.stop(start + 0.15);
      });

      // Fade out
      gain.gain.setValueAtTime(notificationVolume * 0.3, ctx.currentTime + notes.length * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + notes.length * 0.12 + 0.3);
    } catch {
      // Audio not available (SSR, test env)
    }
  }, [notificationSoundEnabled, notificationVolume]);

  return { play };
}
