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
      className={cn(
        'pointer-events-none m-0 mt-3 border-y border-line py-3.5 text-muted uppercase md:mt-0 md:flex md:min-h-0 md:w-[230px] md:flex-1 md:flex-col md:justify-end md:border-y-0 md:py-0 md:transition-[opacity,translate,visibility] md:duration-300 md:ease-out md:[container:legend/size] md:motion-reduce:transition-none',
        isQuakeSelected && 'md:invisible md:translate-x-6 md:opacity-0',
      )}
    >
      <figcaption className="sr-only">{m.depth_legend_label({ shallowest, deepest })}</figcaption>
      <div
        aria-hidden
        data-testid="depth-legend-row"
        data-ring-obstacle
        data-label-obstacle
        className="flex flex-col gap-2.5 md:hidden legend-cramped:flex! legend-tiny:hidden!"
      >
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
      <div
        aria-hidden
        data-testid="depth-legend-column"
        data-ring-obstacle
        data-label-obstacle
        className="mr-[9px] mb-[26px] hidden min-h-0 flex-col items-end gap-1 self-end md:flex legend-cramped:hidden!"
      >
        <div className="flex w-[17px] shrink-0 justify-center text-label">
          <span className="rotate-180 [writing-mode:vertical-rl]">{m.col_depth()}</span>
        </div>
        <div className="flex h-[147px] min-h-10">
          <div className="flex flex-col items-end justify-between text-label-s">
            <span>{shallowest}</span>
            <span>{deepest}</span>
          </div>
          <div className="relative w-[21px]">
            <div
              data-testid="depth-legend-bar"
              className="absolute inset-y-0 left-[9.5px] w-[1.5px]"
              style={{ backgroundImage: DEPTH_BAR_GRADIENT }}
            />
          </div>
        </div>
      </div>
    </figure>
  );
}
