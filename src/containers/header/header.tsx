import { getRouteApi } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { AboutDialog } from '@/containers/about/about-dialog';
import { LanguageSwitch } from '@/containers/language-switch/language-switch';
import { getLiveSnapshot, playbackClock } from '@/lib/earthquakes/playback-clock';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import type { EarthquakeSource } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

const homeRoute = getRouteApi('/');

function getBrandClassName(isDetail: boolean): string {
  return isDetail
    ? 'absolute top-[54px] left-4 flex h-control items-center gap-7 md:left-14'
    : 'absolute top-[58px] left-4 flex items-center gap-5 md:left-14';
}

function getStatusLabel(source: EarthquakeSource, isLive: boolean): string {
  const label = SOURCE_ADAPTERS[source].label;
  return isLive ? `${m.header_live()} · ${label}` : label;
}

function LiveStatus({ source }: { source: EarthquakeSource }) {
  const { playhead } = useSyncExternalStore(
    playbackClock.subscribe,
    playbackClock.getSnapshot,
    getLiveSnapshot,
  );
  const isLive = playhead === null;

  return (
    <output className="hidden items-center gap-2 text-label text-muted uppercase md:flex">
      {isLive && (
        <span data-live-dot aria-hidden="true" className="size-[5px] rounded-full bg-foreground" />
      )}
      <span>{getStatusLabel(source, isLive)}</span>
    </output>
  );
}

export function Header() {
  const { quake, source } = homeRoute.useSearch();
  const isDetail = quake !== undefined;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10">
      <div className={getBrandClassName(isDetail)}>
        <Wordmark />
        <AboutDialog />
      </div>
      {!isDetail && (
        <div className="absolute top-[56px] right-4 flex h-3 items-center gap-6 md:right-[71px]">
          <LiveStatus source={source} />
          <LanguageSwitch />
        </div>
      )}
    </header>
  );
}
