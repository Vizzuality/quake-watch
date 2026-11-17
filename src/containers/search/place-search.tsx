import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useFilterSearch } from '@/hooks/use-filter-search';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { type RegionSuggestion, getRegionSuggestions } from '@/lib/earthquakes/regions';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getDecimalLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

const homeRoute = getRouteApi('/');
const EMPTY_EARTHQUAKES: Earthquake[] = [];
const ARROW_STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

function ClearIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12.5 3.5L3.5 12.5M12.5 12.5L3.5 3.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function getOptionClassName(isActive: boolean): string {
  const background = isActive ? 'bg-line' : '';
  return `flex cursor-pointer items-baseline justify-between gap-4 px-3 py-2 ${background}`;
}

function getNextIndex(index: number, step: number, count: number): number {
  return (index + step + count) % count;
}

type SuggestionsProps = {
  id: string;
  suggestions: RegionSuggestion[];
  activeIndex: number;
  onPick: (suggestion: RegionSuggestion) => void;
};

function Suggestions({ id, suggestions, activeIndex, onPick }: SuggestionsProps) {
  const locale = getLocale();

  if (suggestions.length === 0) {
    return (
      <output className="block px-3 py-2 text-body-s text-muted">
        {m.search_empty({}, { locale })}
      </output>
    );
  }
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a native select or datalist cannot render the styled suggestions of the combobox pattern
    <div id={id} role="listbox" aria-label={m.search_suggestions({}, { locale })}>
      {suggestions.map((suggestion, index) => (
        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- the combobox input owns the keyboard (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
        <div
          key={suggestion.name}
          id={`${id}-${index}`}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a native option cannot live outside a select
          role="option"
          tabIndex={-1}
          aria-selected={index === activeIndex}
          className={getOptionClassName(index === activeIndex)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(suggestion)}
        >
          <span className="truncate text-body-s text-foreground">{suggestion.name}</span>{' '}
          <span className="text-label text-muted">{getDecimalLabel(suggestion.count, locale)}</span>
        </div>
      ))}
    </div>
  );
}

export function PlaceSearch() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const setSearch = useFilterSearch();
  const locale = getLocale();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { place } = search;
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const [text, setText] = useState(place ?? '');
  const [syncedPlace, setSyncedPlace] = useState(place);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => getRegionSuggestions(earthquakes, text), [earthquakes, text]);
  const isListShown = isOpen && text.trim() !== '';
  const hasOptions = isListShown && suggestions.length > 0;
  const controlsId = hasOptions ? listboxId : undefined;
  const activeOption = hasOptions ? `${listboxId}-${activeIndex}` : undefined;

  if (place !== syncedPlace) {
    setSyncedPlace(place);
    setText(place ?? '');
  }

  function pick(suggestion: RegionSuggestion) {
    setText(suggestion.name);
    setIsOpen(false);
    void setSearch({ place: suggestion.name });
  }

  function clear() {
    setText('');
    setIsOpen(false);
    if (place !== undefined) void setSearch({ place: undefined });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setActiveIndex(0);
    if (next.trim() === '') {
      clear();
      return;
    }
    setText(next);
    setIsOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const step = ARROW_STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setIsOpen(true);
      if (hasOptions) setActiveIndex(getNextIndex(activeIndex, step, suggestions.length));
      return;
    }
    if (event.key !== 'Enter' || !hasOptions) return;
    event.preventDefault();
    pick(suggestions[activeIndex]);
  }

  function handleClearClick() {
    clear();
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!isListShown) return;
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setIsOpen(false);
    }
    window.addEventListener('keydown', handleEscape, { capture: true });
    return () => window.removeEventListener('keydown', handleEscape, { capture: true });
  }, [isListShown]);

  if (search.quake !== undefined) return null;
  return (
    <div
      data-testid="place-search"
      className="pointer-events-auto absolute bottom-14 left-14 z-20 w-[257px]"
    >
      {isListShown && (
        <div className="absolute inset-x-0 bottom-full mb-2 border border-line bg-glass-panel py-1 backdrop-blur-[50px]">
          <Suggestions
            id={listboxId}
            suggestions={suggestions}
            activeIndex={activeIndex}
            onPick={pick}
          />
        </div>
      )}
      <div className="flex items-center gap-2.5 border-b border-muted pb-2.5">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={m.search_label({}, { locale })}
          aria-autocomplete="list"
          aria-expanded={hasOptions}
          aria-controls={controlsId}
          aria-activedescendant={activeOption}
          autoComplete="off"
          spellCheck={false}
          placeholder={m.search_label({}, { locale })}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          className="h-4 min-w-0 flex-1 bg-transparent text-label text-foreground uppercase caret-accent outline-none placeholder:text-muted"
        />
        {text !== '' && (
          <button
            type="button"
            aria-label={m.search_clear({}, { locale })}
            onClick={handleClearClick}
            className="flex size-4 shrink-0 cursor-pointer items-center justify-center text-muted hover:text-foreground focus-visible:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <ClearIcon />
          </button>
        )}
      </div>
    </div>
  );
}
