export const ARRIVAL_PULSE = {
  rgb: [235, 89, 142],
  waveMs: 4_500,
  waveK: 1.2,
  durationMs: 6_000,
  ringPeriodMs: 1_600,
  ringCount: 3,
  ringStartPx: 6,
  ringGrowPx: 38,
  ringA: 0.85,
  glowPx: 14,
  glowA: 0.9,
} as const;

export function getArrivedIds(previous: ReadonlySet<string> | null, current: readonly string[]) {
  if (!previous) return new Set<string>();
  return new Set(current.filter((id) => !previous.has(id)));
}

export function getNewestArrivedId(
  arrived: ReadonlySet<string>,
  earthquakes: readonly { id: string; time: number }[],
): string | undefined {
  let newest: { id: string; time: number } | undefined;
  for (const earthquake of earthquakes) {
    if (arrived.has(earthquake.id) && (!newest || earthquake.time > newest.time))
      newest = earthquake;
  }
  return newest?.id;
}

function getPulseFade(elapsedMs: number): number {
  return 1 - elapsedMs / ARRIVAL_PULSE.durationMs;
}

function getRingPhase(elapsedMs: number, ring: number): number {
  return (elapsedMs / ARRIVAL_PULSE.ringPeriodMs + ring / ARRIVAL_PULSE.ringCount) % 1;
}

export function getPulseRingRadiusPx(elapsedMs: number, ring: number): number {
  return ARRIVAL_PULSE.ringStartPx + getRingPhase(elapsedMs, ring) * ARRIVAL_PULSE.ringGrowPx;
}

export function getPulseRingAlpha(elapsedMs: number, ring: number): number {
  if (!(elapsedMs >= 0 && elapsedMs < ARRIVAL_PULSE.durationMs)) return 0;
  return (1 - getRingPhase(elapsedMs, ring)) * ARRIVAL_PULSE.ringA * getPulseFade(elapsedMs);
}

export function getPulseGlowAlpha(elapsedMs: number): number {
  if (!(elapsedMs >= 0)) return 0;
  return ARRIVAL_PULSE.glowA * Math.min(1, Math.max(0, getPulseFade(elapsedMs)));
}
