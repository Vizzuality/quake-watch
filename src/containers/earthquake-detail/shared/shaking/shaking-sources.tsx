import { Skeleton } from '@/components/ui/skeleton';
import { m } from '@/paraglide/messages';

const IRIS_WAVES_URL = 'https://www.iris.edu/hq/inclass/animation/p_wave_vs_s_wave';
const BGS_WAVES_URL =
  'https://www.bgs.ac.uk/discovering-geology/earth-hazards/earthquakes/how-are-earthquakes-detected/';
const SOURCE_LINK_CLASS_NAME = 'text-paper underline underline-offset-2';

export function SourceLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={SOURCE_LINK_CLASS_NAME}>
      {children}
    </a>
  );
}

export function WaveSources() {
  return (
    <p>
      {m.detail_shakemap_explainer_source()}{' '}
      <SourceLink href={IRIS_WAVES_URL}>{m.detail_shakemap_source_link()}</SourceLink>
      {' · '}
      <SourceLink href={BGS_WAVES_URL}>{m.detail_shakemap_source_link_bgs()}</SourceLink>
    </p>
  );
}

export function ShakingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-80 w-full rounded-lg sm:h-[28rem]" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
