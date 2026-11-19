import { useIsQuakeSelected } from '@/hooks/use-is-quake-selected';
import { DEPTH_COLOR_STOPS, getDepthGradient } from '@/lib/earthquakes/depth-color';
import { getKmLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

const DEPTH_BAR_GRADIENT = getDepthGradient(180);
const SHALLOWEST_KM = DEPTH_COLOR_STOPS[0][0];
const DEEPEST_KM = DEPTH_COLOR_STOPS[DEPTH_COLOR_STOPS.length - 1][0];

export function DepthLegend() {
  const isQuakeSelected = useIsQuakeSelected();
  const locale = getLocale();
  const shallowest = getKmLabel(SHALLOWEST_KM, locale);
  const deepest = getKmLabel(DEEPEST_KM, locale);

  return (
    <figure
      aria-hidden={isQuakeSelected}
      inert={isQuakeSelected}
      data-testid="depth-legend"
      className={cn(
        'pointer-events-none absolute right-[65px] bottom-[140px] z-10 m-0 flex flex-col items-end gap-1 text-muted uppercase transition-[opacity,translate,visibility] duration-300 ease-out motion-reduce:transition-none',
        isQuakeSelected && 'invisible translate-x-6 opacity-0',
      )}
    >
      <figcaption className="sr-only">{m.depth_legend_label({ shallowest, deepest })}</figcaption>
      <div aria-hidden className="flex w-[17px] justify-center text-label">
        <span className="rotate-180 [writing-mode:vertical-rl]">{m.col_depth()}</span>
      </div>
      <div aria-hidden className="flex h-[147px]">
        <div className="flex flex-col items-end justify-between text-label-s">
          <span>{shallowest}</span>
          <span>{deepest}</span>
        </div>
        <div className="relative w-[21px]">
          <div
            data-testid="depth-legend-bar"
            className="absolute top-0 left-[9.5px] h-[147px] w-[1.5px]"
            style={{ backgroundImage: DEPTH_BAR_GRADIENT }}
          />
        </div>
      </div>
    </figure>
  );
}
