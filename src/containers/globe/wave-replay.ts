type WaveReplayListener = (id: string) => void;

const listeners = new Set<WaveReplayListener>();

export function requestWaveReplay(id: string) {
  for (const listener of listeners) listener(id);
}

export function subscribeWaveReplay(listener: WaveReplayListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
