import { getRouteApi } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { AboutDialog } from '@/containers/about/about-dialog';
import { LanguageSwitch } from '@/containers/language-switch/language-switch';
import { getLiveSnapshot, playbackClock } from '@/lib/earthquakes/playback-clock';
import { getSourceLabel } from '@/lib/earthquakes/query-options';
import type { SourceFilter } from '@/lib/earthquakes/search-schema';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

const homeRoute = getRouteApi('/');

function getHeaderClassName(isDetail: boolean): string {
  return isDetail
    ? 'pointer-events-none absolute inset-x-0 top-0 z-10'
    : 'pointer-events-none absolute inset-x-5 top-[50px] z-10 flex h-10 items-center gap-4 md:inset-x-0 md:top-0 md:block md:h-auto';
}

function getBrandClassName(isDetail: boolean): string {
  return isDetail
    ? 'absolute top-[54px] left-4 hidden h-control items-center gap-7 md:left-14 md:flex'
    : 'contents md:absolute md:top-[58px] md:left-14 md:flex md:items-center md:gap-5';
}

function getWordmarkClassName(isDetail: boolean): string {
  return isDetail ? '' : 'mr-auto h-auto w-[124px] md:mr-0 md:w-[159px]';
}

function getStatusLabel(source: SourceFilter, isLive: boolean): string {
  const label = getSourceLabel(source);
  return isLive ? `${m.header_live()} · ${label}` : label;
}

function getNarrowSourceLabel(source: SourceFilter): string {
  return source === 'all' ? m.filter_source_all() : getSourceLabel(source);
}

function LiveStatus({ source }: { source: SourceFilter }) {
  const { playhead } = useSyncExternalStore(
    playbackClock.subscribe,
    playbackClock.getSnapshot,
    getLiveSnapshot,
  );
  const isLive = playhead === null;

  return (
    <output className="flex items-center gap-[7px] text-caption whitespace-nowrap text-foreground uppercase md:gap-2 md:text-label md:text-muted">
      {isLive && (
        <span data-live-dot aria-hidden="true" className="size-[5px] rounded-full bg-foreground" />
      )}
      <span className={cn(isLive && 'max-[379px]:sr-only')}>{getStatusLabel(source, isLive)}</span>
      {isLive && (
        <span
          aria-hidden="true"
          data-label={getNarrowSourceLabel(source)}
          className="before:content-[attr(data-label)] min-[380px]:hidden"
        />
      )}
    </output>
  );
}

export function Header() {
  const { quake, source } = homeRoute.useSearch();
  const isDetail = quake !== undefined;

  return (
    <header className={getHeaderClassName(isDetail)}>
      <div className={getBrandClassName(isDetail)}>
        <Wordmark className={getWordmarkClassName(isDetail)} />
        <div className="order-last md:contents [&>button]:min-h-11 md:[&>button]:min-h-0">
          <AboutDialog />
        </div>
      </div>
      {!isDetail && (
        <div className="flex items-center md:absolute md:top-[56px] md:right-[71px] md:h-3 md:gap-6">
          <LiveStatus source={source} />
          <LanguageSwitch className="hidden md:flex" />
        </div>
      )}
    </header>
  );
}
