import { useId } from 'react';

import { getPaletteColor } from '@/lib/shakemap/coverage';
import type { ShakemapPalette } from '@/lib/shakemap/coverage';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { getCssColor, getIntensityShortLabel } from './shakemap-labels';

const LEGEND_INTENSITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function ShakemapLegend({ palette }: { palette: ShakemapPalette }) {
  const titleId = useId();
  const locale = getLocale();

  return (
    <div className="flex flex-col gap-2 text-xs text-muted">
      <span id={titleId} className="font-medium text-paper">
        {m.detail_shakemap_legend_title()}
      </span>
      <ol aria-labelledby={titleId} className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
        {LEGEND_INTENSITIES.map((intensity) => (
          <li key={intensity} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm ring-1 ring-ink/40"
              style={{ backgroundColor: getCssColor(getPaletteColor(palette, intensity)) }}
            />
            {getIntensityShortLabel(intensity, locale)}
          </li>
        ))}
      </ol>
      <p>{m.detail_shakemap_legend_lines()}</p>
    </div>
  );
}
