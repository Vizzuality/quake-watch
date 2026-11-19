import { getRouteApi } from '@tanstack/react-router';
import { type ReactNode, useId } from 'react';

import { DETAIL_VIEWS, type DetailView } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

const homeRoute = getRouteApi('/');

const FOCUS_RING_CLASS_NAME =
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-[3px] has-focus-visible:outline-accent';

function MapIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      className="size-3.5"
    >
      <path
        d="M2 3.6 6 2l4 1.6L14 2v10.4L10 14l-4-1.6L2 14Z M6 2v10.4 M10 3.6V14"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      className="size-3.5"
    >
      <path
        d="M8 2 14 5.3 8 8.6 2 5.3Z M2 8.2l6 3.3 6-3.3 M2 11.1l6 3.3 6-3.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const VIEW_LOOK: Record<DetailView, { icon: ReactNode; label: () => string }> = {
  map: { icon: <MapIcon />, label: m.section_view_map },
  section: { icon: <StackIcon />, label: m.section_view_section },
};

function getSegmentClassName(isSelected: boolean): string {
  return isSelected ? 'bg-selected text-on-selected' : 'text-foreground hover:text-accent';
}

function getSectionRingClassName(isSectionSelected: boolean): string {
  return isSectionSelected
    ? 'outline-2 outline-offset-[3px] outline-accent'
    : FOCUS_RING_CLASS_NAME;
}

export function ViewToggle() {
  const { view } = homeRoute.useSearch();
  const navigate = homeRoute.useNavigate();
  const name = useId();

  function select(next: DetailView) {
    void navigate({ search: (prev) => ({ ...prev, view: next }) });
  }

  return (
    <fieldset
      data-testid="view-toggle"
      className="pointer-events-auto absolute top-24 right-4 flex h-8 items-center gap-0.5 rounded-pill border border-line-control p-0.5 md:top-29 md:right-14 md:hidden md:h-control md:gap-0 md:p-[3px] lg:flex"
    >
      <legend className="sr-only">{m.section_view_label()}</legend>
      {DETAIL_VIEWS.map((option) => {
        const isSelected = option === view;
        return (
          <label
            key={option}
            className={`relative flex h-full cursor-pointer items-center gap-1.5 rounded-pill px-2.5 text-button uppercase before:absolute before:inset-x-0 before:-inset-y-[9px] md:static md:px-3 md:before:hidden ${getSegmentClassName(isSelected)} ${getSectionRingClassName(isSelected && option === 'section')}`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={isSelected}
              onChange={() => select(option)}
              className="sr-only"
            />
            {VIEW_LOOK[option].icon}
            {VIEW_LOOK[option].label()}
          </label>
        );
      })}
    </fieldset>
  );
}
