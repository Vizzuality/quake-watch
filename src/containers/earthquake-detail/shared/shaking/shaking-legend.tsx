import { type ReactNode, useId } from 'react';

import { FILL_MIN_MMI } from '@/lib/shakemap/canvas';
import { getPaletteColor } from '@/lib/shakemap/coverage';
import type { ShakemapPalette } from '@/lib/shakemap/coverage';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { getCssColor, getIntensityShortLabel, getSwatchClassName } from './shaking-labels';

const LEGEND_INTENSITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function ShakingLegend({
  palette,
  fillFromMmi = FILL_MIN_MMI,
  title = m.detail_shakemap_legend_title(),
  children,
}: {
  palette: ShakemapPalette;
  fillFromMmi?: number;
  title?: string;
  children?: ReactNode;
}) {
  const titleId = useId();
  const wavesId = useId();
  const locale = getLocale();

  return (
    <div className="flex flex-col gap-3 text-xs text-muted">
      <div className="flex flex-col gap-2">
        <span id={titleId} className="font-medium text-paper">
          {title}
        </span>
        <ol aria-labelledby={titleId} className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
          {LEGEND_INTENSITIES.map((intensity) => (
            <li key={intensity} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={getSwatchClassName(intensity >= fillFromMmi)}
                style={{ backgroundColor: getCssColor(getPaletteColor(palette, intensity)) }}
              />
              {getIntensityShortLabel(intensity, locale)}
            </li>
          ))}
        </ol>
        {children}
      </div>
      <div className="flex flex-col gap-2">
        <span id={wavesId} className="font-medium text-paper">
          {m.detail_shakemap_waves_title()}
        </span>
        <ul aria-labelledby={wavesId} className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-px w-5 shrink-0 bg-paper/60" />
            {m.detail_shakemap_wave_p()}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-[3px] w-5 shrink-0 rounded-full bg-paper" />
            {m.detail_shakemap_wave_s()}
          </li>
        </ul>
      </div>
    </div>
  );
}
