import { WAVE_SCREEN_MS } from './wave';

export function getAdvancedSeconds(
  seconds: number,
  elapsedMs: number,
  durationSeconds: number,
): number {
  return Math.min(
    durationSeconds,
    seconds + (Math.max(0, elapsedMs) / WAVE_SCREEN_MS) * durationSeconds,
  );
}

export function getPlayStartSeconds(seconds: number, durationSeconds: number): number {
  return seconds >= durationSeconds ? 0 : seconds;
}

export function getInitialSeconds(reducedMotion: boolean, durationSeconds: number): number {
  return reducedMotion ? durationSeconds : 0;
}

export function getRunDurationSeconds(runEndSeconds: number): number {
  return Math.max(1, Math.ceil(runEndSeconds));
}
