import { useId } from 'react';

import { getCrustLayers } from '@/lib/crust/block';
import { BAND_KINDS, type BandKind, DEEP_BOUNDARY_BANDS } from '@/lib/crust/scene';
import { m } from '@/paraglide/messages';

import { BAND_NAMES } from './crust-messages';
import { CRUST_PALETTE } from './crust-palette';
import { type CrustalBlockProps, useCrustalBlock } from './use-crustal-block';

const CRUST1_URL = 'https://igppweb.ucsd.edu/~gabi/crust1.html';
const TERRAIN_ATTRIBUTION_URL = 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md';

const LINK_CLASS_NAME =
  'underline-offset-2 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-fg';

export function CrustalBlockLegend(props: CrustalBlockProps) {
  const titleId = useId();
  const { blockCells, deepBoundaries } = useCrustalBlock(props);
  const presentKinds = new Set<BandKind>([
    ...blockCells.flatMap((cell) => getCrustLayers(cell).map((layer) => layer.kind)),
    'upper-mantle',
    ...deepBoundaries.map((boundary) => DEEP_BOUNDARY_BANDS[boundary.kind]),
  ]);
  const kinds = BAND_KINDS.filter((kind) => presentKinds.has(kind));

  return (
    <div className="flex flex-col gap-3 text-xs text-muted">
      <div className="flex flex-col gap-2">
        <span id={titleId} className="font-medium text-fg">
          {m.crustal_block_legend_title()}
        </span>
        <ul aria-labelledby={titleId} className="grid grid-cols-2 gap-x-4 gap-y-1.5 lg:grid-cols-1">
          {kinds.map((kind) => (
            <li key={kind} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-sm ring-1 ring-canvas/40"
                style={{ backgroundColor: CRUST_PALETTE[kind] }}
              />
              {BAND_NAMES[kind]()}
            </li>
          ))}
        </ul>
      </div>
      <p>{m.crustal_block_relief_note()}</p>
      <div className="flex flex-col gap-1">
        <span className="font-medium text-fg">{m.crustal_block_sources()}</span>
        <a href={CRUST1_URL} target="_blank" rel="noreferrer" className={LINK_CLASS_NAME}>
          {m.crustal_block_attribution_crust()}
        </a>
        <a
          href={TERRAIN_ATTRIBUTION_URL}
          target="_blank"
          rel="noreferrer"
          className={LINK_CLASS_NAME}
        >
          {m.crustal_block_attribution_terrain()}
        </a>
      </div>
    </div>
  );
}
