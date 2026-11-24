import { getRouteApi } from '@tanstack/react-router';
import { type FocusEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { requestGlobeFlyTo } from '@/containers/globe/globe-fly-to';
import { requestGlobeSelect } from '@/containers/globe/globe-select';
import { getQuakeKey } from '@/containers/globe/use-hovered-quake';
import { useArrivals } from '@/hooks/use-arrivals';
import { useIsQuakeSelected } from '@/hooks/use-is-quake-selected';
import { usePhoneLayout } from '@/hooks/use-phone-layout';
import { getNewestArrival, isNoteworthyArrival } from '@/lib/earthquakes/arrivals';
import { getTooltipMagnitude } from '@/lib/earthquakes/tooltip';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel } from '@/lib/format';
import {
  focusHomeSheetHandle,
  getIsHomeSheetOpen,
  getIsHomeSheetOpenOnServer,
  subscribeHomeSheet,
} from '@/lib/layout/home-sheet-store';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

const homeRoute = getRouteApi('/');
const AUTO_DISMISS_MS = 15_000;
const BANNER_GAP_PX = 2;

function getNoteworthyArrival(arrived: readonly Earthquake[]): Earthquake | undefined {
  return getNewestArrival(arrived.filter(isNoteworthyArrival));
}

function getMetaLine({ depthKm }: Earthquake, locale: Locale): string {
  const depth = m.tooltip_depth_deep({ depth: getKmLabel(depthKm, locale) }, { locale });
  return `${m.live_banner_just_now({}, { locale })} · ${depth}`;
}

function getTitle({ magnitude }: Earthquake, locale: Locale): string {
  return m.live_banner_title({ magnitude: getTooltipMagnitude(magnitude, locale) }, { locale });
}

function getPlace({ place }: Earthquake, locale: Locale): string {
  return place ?? m.place_unknown({}, { locale });
}

function getAnnouncement(
  arrival: Earthquake | null,
  announcedKey: string | null,
  locale: Locale,
): string {
  if (arrival === null || getQuakeKey(arrival) !== announcedKey) return '';
  return `${getTitle(arrival, locale)}. ${getPlace(arrival, locale)}. ${getMetaLine(arrival, locale)}`;
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor" className="size-[13px]">
      <path d="M220.24,132.24l-72,72a6,6,0,0,1-8.48-8.48L201.51,134H40a6,6,0,0,1,0-12H201.51L139.76,60.24a6,6,0,0,1,8.48-8.48l72,72A6,6,0,0,1,220.24,132.24Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor" className="size-[13px]">
      <path d="M204.24,195.76a6,6,0,1,1-8.48,8.48L128,136.49,60.24,204.24a6,6,0,0,1-8.48-8.48L119.51,128,51.76,60.24a6,6,0,0,1,8.48-8.48L128,119.51l67.76-67.75a6,6,0,0,1,8.48,8.48L136.49,128Z" />
    </svg>
  );
}

export function LiveBanner() {
  const navigate = homeRoute.useNavigate();
  const isQuakeSelected = useIsQuakeSelected();
  const layout = usePhoneLayout();
  const isSheetOpen = useSyncExternalStore(
    subscribeHomeSheet,
    getIsHomeSheetOpen,
    getIsHomeSheetOpenOnServer,
  );
  const locale = getLocale();
  const [arrival, setArrival] = useState<Earthquake | null>(null);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [announcedKey, setAnnouncedKey] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const shown = isSheetOpen || isQuakeSelected ? null : arrival;
  const shownKey = shown && getQuakeKey(shown);
  if (shownKey && shownKey !== announcedKey) setAnnouncedKey(shownKey);
  const announcement = getAnnouncement(arrival, announcedKey, locale);

  function dismiss() {
    setArrival(null);
    setIsFocusWithin(false);
  }

  function close() {
    if (bannerRef.current?.contains(document.activeElement)) focusHomeSheetHandle();
    dismiss();
  }

  function handleOpen(earthquake: Earthquake) {
    dismiss();
    if (requestGlobeSelect(earthquake)) return;
    void navigate({ search: (prev) => ({ ...prev, quake: getQuakeKey(earthquake) }) });
  }

  function handleFlyTo(earthquake: Earthquake) {
    close();
    requestGlobeFlyTo(earthquake);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusWithin(false);
  }

  useArrivals((arrived) => {
    const noteworthy = getNoteworthyArrival(arrived);
    if (noteworthy) setArrival(noteworthy);
  });

  useEffect(() => {
    if (arrival === null || isFocusWithin) return;
    const id = window.setTimeout(() => setArrival(null), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [arrival, isFocusWithin]);

  return (
    <div className="md:hidden">
      <output className="sr-only">{announcement}</output>
      {shown && (
        <div
          ref={bannerRef}
          style={{ top: (layout?.headerBottom ?? 0) + BANNER_GAP_PX }}
          className="pointer-events-auto absolute right-4 left-[max(1rem,env(safe-area-inset-left))] z-10 flex items-center gap-3 rounded-[6px] border border-line-toast glass-toast px-3.5 py-3 text-foreground motion-safe:transition-[translate,opacity] motion-safe:duration-300 motion-safe:starting:-translate-y-2 motion-safe:starting:opacity-0 short:right-84"
          onFocus={() => setIsFocusWithin(true)}
          onBlur={handleBlur}
        >
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
          <button
            type="button"
            onClick={() => handleOpen(shown)}
            className="flex min-w-0 flex-1 cursor-pointer flex-col gap-[3px] text-left"
          >
            <span className="text-caption-bold text-accent uppercase">
              {getTitle(shown, locale)}
            </span>
            <span className="line-clamp-2 text-[12px] leading-[1.3]">
              {getPlace(shown, locale)}
            </span>
            <span className="text-caption text-muted uppercase">{getMetaLine(shown, locale)}</span>
          </button>
          <button
            type="button"
            onClick={() => handleFlyTo(shown)}
            className="group -my-[7px] flex h-11 shrink-0 cursor-pointer items-center"
          >
            <span className="flex h-[30px] items-center gap-2 rounded-pill border border-line-control px-3 text-button whitespace-nowrap uppercase transition-colors group-hover:border-muted">
              {m.live_banner_fly_to()}
              <ArrowRightIcon />
            </span>
          </button>
          <button
            type="button"
            aria-label={m.live_banner_dismiss()}
            onClick={close}
            className="-m-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center text-muted transition-colors hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}
