export type FeatureStateTarget = {
  setFeatureState(feature: { source: string; id: number }, state: { passed: boolean }): void;
};

export function syncPassedSegments(
  map: FeatureStateTarget,
  source: string,
  fromCount: number,
  toCount: number,
) {
  const from = Math.min(fromCount, toCount);
  const to = Math.max(fromCount, toCount);
  for (let id = from; id < to; id++) {
    map.setFeatureState({ source, id }, { passed: id < toCount });
  }
}
