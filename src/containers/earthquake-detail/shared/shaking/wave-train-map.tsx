import { type ReactNode, useMemo, useRef } from 'react';

import type { Earthquake } from '@/lib/earthquakes/types';
import type { TrainBounds, WaveTrainShape } from '@/lib/shakemap/wave-train';

import { DetailMinimap } from '../detail-minimap';
import { useWaveLoop } from './use-wave-loop';
import { WaveTrainControls } from './wave-train-controls';
import { WaveTrainLayer } from './wave-train-layer';

export function WaveTrainMap({
  earthquake,
  shape,
  bounds,
  legend,
  children,
}: {
  earthquake: Earthquake;
  shape: WaveTrainShape;
  bounds: TrainBounds | null;
  legend: ReactNode;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { playing, running, frozen, toggle } = useWaveLoop(ref);
  const epicenter = useMemo(
    () => ({ latitude: earthquake.latitude, longitude: earthquake.longitude }),
    [earthquake.latitude, earthquake.longitude],
  );

  return (
    <div ref={ref}>
      <DetailMinimap
        earthquake={earthquake}
        bounds={bounds}
        overlay={<WaveTrainControls playing={playing} onToggle={toggle} legend={legend} />}
      >
        {children}
        <WaveTrainLayer shape={shape} epicenter={epicenter} running={running} frozen={frozen} />
      </DetailMinimap>
    </div>
  );
}
