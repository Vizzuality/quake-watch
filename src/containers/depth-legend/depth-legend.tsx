import { useIsQuakeSelected } from '@/hooks/use-is-quake-selected';
import { DEPTH_COLOR_STOPS, getDepthGradient } from '@/lib/earthquakes/depth-color';
import { getKmLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

const DEPTH_BAR_GRADIENT = getDepthGradient(180);
const DEPTH_ROW_GRADIENT = getDepthGradient(90);
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
      data-ring-obstacle
      data-label-obstacle
      className={cn(
        'pointer-events-none m-0 mt-3 border-y border-line py-3.5 text-muted uppercase md:absolute md:right-[65px] md:bottom-[140px] md:z-10 md:mt-0 md:flex md:flex-col md:items-end md:gap-1 md:border-y-0 md:py-0 md:transition-[opacity,translate,visibility] md:duration-300 md:ease-out md:motion-reduce:transition-none',
        isQuakeSelected && 'md:invisible md:translate-x-6 md:opacity-0',
      )}
    >
      <figcaption className="sr-only">{m.depth_legend_label({ shallowest, deepest })}</figcaption>
      <div aria-hidden className="flex flex-col gap-2.5 md:hidden">
        <span className="text-caption">{m.col_depth()}</span>
        <div className="flex flex-col gap-1.5">
          <div className="h-[1.5px]" style={{ backgroundImage: DEPTH_ROW_GRADIENT }} />
          <div
            className="flex justify-between text-caption before:content-[attr(data-from)] after:content-[attr(data-to)]"
            data-from={m.depth_legend_surface()}
            data-to={deepest}
          />
        </div>
      </div>
      <div aria-hidden className="hidden w-[17px] justify-center text-label md:flex">
        <span className="rotate-180 [writing-mode:vertical-rl]">{m.col_depth()}</span>
      </div>
      <div aria-hidden className="hidden h-[147px] md:flex">
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
