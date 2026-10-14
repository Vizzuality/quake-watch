import { SHAKEMAP_PLAY_DURATION_MS } from './reveal';

export function getAdvancedProgress(progress: number, elapsedMs: number): number {
  return Math.min(1, progress + Math.max(0, elapsedMs) / SHAKEMAP_PLAY_DURATION_MS);
}

export function getPlayStartProgress(progress: number): number {
  return progress >= 1 ? 0 : progress;
}

export function getInitialProgress(reducedMotion: boolean): number {
  return reducedMotion ? 1 : 0;
}
