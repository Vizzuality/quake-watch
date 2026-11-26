import { useEffect, useRef, useSyncExternalStore } from 'react';

import { BottomSheet } from '@/components/bottom-sheet/bottom-sheet';
import { DepthLegend } from '@/containers/depth-legend/depth-legend';
import { FiltersPanel } from '@/containers/filters/filters-panel';
import { LanguageSwitch } from '@/containers/language-switch/language-switch';
import { PlaceSearch } from '@/containers/search/place-search';
import { SummaryPanel } from '@/containers/summary/summary-panel';
import { LiveRow } from '@/containers/timeline/live-row';
import { useIsQuakeSelected } from '@/hooks/use-is-quake-selected';
import { usePhoneLayout } from '@/hooks/use-phone-layout';
import {
  getIsHomeSheetOpen,
  getIsHomeSheetOpenOnServer,
  setHomeSheetHandle,
  setHomeSheetOpen,
  subscribeHomeSheet,
} from '@/lib/layout/home-sheet-store';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

import { RightRail } from './right-rail';

function isFocusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

function LanguageGroup() {
  return (
    <div className="flex flex-col gap-1 pt-3.5 md:hidden">
      <p
        aria-hidden="true"
        className="text-[9.5px] leading-[1.2] font-medium tracking-[0.2em] text-muted uppercase"
      >
        {m.language_switch_label()}
      </p>
      <LanguageSwitch className="-ml-3 gap-0" />
    </div>
  );
}

export function HomeSheet() {
  const isQuakeSelected = useIsQuakeSelected();
  const layout = usePhoneLayout();
  const isOpen = useSyncExternalStore(
    subscribeHomeSheet,
    getIsHomeSheetOpen,
    getIsHomeSheetOpenOnServer,
  );
  const handleRef = useRef<HTMLButtonElement>(null);
  const wasQuakeSelectedRef = useRef(isQuakeSelected);

  function handleFiltersClick() {
    setHomeSheetOpen(true);
    handleRef.current?.focus();
  }

  useEffect(() => {
    setHomeSheetHandle(handleRef.current);
    return () => setHomeSheetHandle(null);
  }, []);

  useEffect(() => {
    const wasQuakeSelected = wasQuakeSelectedRef.current;
    wasQuakeSelectedRef.current = isQuakeSelected;
    if (isQuakeSelected) setHomeSheetOpen(false);
    else if (wasQuakeSelected && isFocusLost()) handleRef.current?.focus();
  }, [isQuakeSelected]);

  return (
    <BottomSheet
      label={m.home_sheet_label()}
      isOpen={isOpen}
      onOpenChange={setHomeSheetOpen}
      collapsedTop={layout?.homeSheetTop}
      expandedTop={layout?.homeSheetOpenTop}
      handleLabels={{ open: m.home_sheet_expand(), close: m.home_sheet_collapse() }}
      handleRef={handleRef}
      className={cn(isQuakeSelected && 'hidden md:contents')}
    >
      <SummaryPanel />
      <LiveRow />
      {!isOpen && (
        <button
          type="button"
          onClick={handleFiltersClick}
          className="group mt-[11px] -mb-[5px] flex h-11 w-full cursor-pointer items-center md:hidden"
        >
          <span className="flex h-control w-full items-center justify-center rounded-pill border border-line-control text-button text-foreground uppercase transition-colors group-hover:border-muted">
            {m.home_sheet_open()}
          </span>
        </button>
      )}
      <div className={cn('md:contents', !isOpen && 'hidden group-data-dragging/sheet:block')}>
        <PlaceSearch />
        <RightRail>
          <FiltersPanel />
          <DepthLegend />
        </RightRail>
        <LanguageGroup />
      </div>
    </BottomSheet>
  );
}
