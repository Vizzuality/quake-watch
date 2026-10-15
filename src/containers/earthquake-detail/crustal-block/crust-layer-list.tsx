import { Datum, DatumList } from '@/components/ui/explainer';
import { type BandKind, DEEP_BOUNDARY_BANDS } from '@/lib/crust/scene';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

import { BAND_EXPLANATIONS, BAND_NAMES, getDepthText } from './crust-messages';
import { CRUST_PALETTE } from './crust-palette';
import { type CrustalBlockProps, useCrustalBlock } from './use-crustal-block';

type LayerRow = {
  key: string;
  depthKm: number;
  label: string;
  value: string;
  explanation: string;
  swatch?: Swatch;
  highlighted?: boolean;
};

type Swatch = { color: string; shape: 'square' | 'dot' };

const SWATCH_SHAPES: Record<Swatch['shape'], string> = {
  square: 'rounded-sm',
  dot: 'rounded-full ring-2 ring-fg/30',
};

const RUPTURE_START_COLOR = '#ffffff';

function getBandRow(kind: BandKind, depthKm: number, value: string): LayerRow {
  return {
    key: kind,
    depthKm,
    label: BAND_NAMES[kind](),
    value,
    explanation: BAND_EXPLANATIONS[kind](),
    swatch: { color: CRUST_PALETTE[kind], shape: 'square' },
  };
}

function getFromText(depthKm: number): string {
  return m.crustal_block_from({ depth: getDepthText(depthKm) });
}

export function CrustLayerList(props: CrustalBlockProps) {
  const { layers, mohoDepthKm, deepBoundaries, ruptureStartDepthKm } = useCrustalBlock(props);
  const unsortedRows: LayerRow[] = [
    ...layers.map((layer) =>
      getBandRow(
        layer.kind,
        layer.topKm,
        m.crustal_block_range({
          top: getDepthText(layer.topKm),
          bottom: getDepthText(layer.bottomKm),
        }),
      ),
    ),
    {
      key: 'moho',
      depthKm: mohoDepthKm,
      label: m.crustal_block_moho(),
      value: getDepthText(mohoDepthKm),
      explanation: m.crustal_block_explain_moho(),
    },
    getBandRow('upper-mantle', mohoDepthKm, getFromText(mohoDepthKm)),
    ...deepBoundaries.map((boundary) =>
      getBandRow(
        DEEP_BOUNDARY_BANDS[boundary.kind],
        boundary.depthKm,
        getFromText(boundary.depthKm),
      ),
    ),
    {
      key: 'rupture-start',
      depthKm: ruptureStartDepthKm,
      label: m.crustal_block_rupture_start(),
      value: getDepthText(ruptureStartDepthKm),
      explanation: m.crustal_block_explain_rupture_start(),
      swatch: { color: RUPTURE_START_COLOR, shape: 'dot' },
      highlighted: true,
    },
  ];
  const rows = unsortedRows.toSorted((a, b) => a.depthKm - b.depthKm);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-fg">{m.crustal_block_list_title()}</h3>
      <DatumList>
        {rows.map((row) => (
          <Datum
            key={row.key}
            label={row.label}
            value={<LayerValue row={row} />}
            explanation={row.explanation}
            className={row.highlighted ? 'bg-fg/5 px-2' : undefined}
          />
        ))}
      </DatumList>
    </div>
  );
}

function LayerValue({ row }: { row: LayerRow }) {
  return (
    <span className="inline-flex items-center gap-2">
      {row.swatch ? (
        <span
          aria-hidden="true"
          className={cn('size-2.5 shrink-0', SWATCH_SHAPES[row.swatch.shape])}
          style={{ backgroundColor: row.swatch.color }}
        />
      ) : null}
      {row.value}
    </span>
  );
}
