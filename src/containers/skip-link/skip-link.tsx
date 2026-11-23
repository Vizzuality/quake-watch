import type { MouseEvent } from 'react';

import { useIsQuakeSelected } from '@/hooks/use-is-quake-selected';
import { DETAILS_HEADING_ID, MAIN_ID, SUMMARY_ID } from '@/lib/layout/skip-targets';
import { m } from '@/paraglide/messages';

function getTargetId(isQuakeSelected: boolean): string {
  return isQuakeSelected ? DETAILS_HEADING_ID : SUMMARY_ID;
}

function getLabel(isQuakeSelected: boolean): string {
  return isQuakeSelected ? m.skip_to_details() : m.skip_to_summary();
}

function getSkipTarget(id: string): HTMLElement | null {
  return document.getElementById(id) ?? document.getElementById(MAIN_ID);
}

export function SkipLink() {
  const isQuakeSelected = useIsQuakeSelected();
  const targetId = getTargetId(isQuakeSelected);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const target = getSkipTarget(targetId);
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus();
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only rounded-pill border border-line-control glass-toast text-button text-foreground uppercase focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5"
    >
      {getLabel(isQuakeSelected)}
    </a>
  );
}
