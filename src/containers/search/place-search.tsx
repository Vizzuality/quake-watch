import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
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
import { type Locale, getLocale } from '@/paraglide/runtime';

import { getNearestRegion } from './nearest-region';

const homeRoute = getRouteApi('/');
const EMPTY_EARTHQUAKES: Earthquake[] = [];
const ARROW_STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };
const LOCATE_OPTIONS: PositionOptions = { timeout: 10_000, maximumAge: 600_000 };

type LocateError = 'denied' | 'unavailable' | 'empty';

const LOCATE_ERROR_MESSAGES: Record<LocateError, (locale: Locale) => string> = {
  denied: (locale) => m.search_locate_denied({}, { locale }),
  unavailable: (locale) => m.search_locate_unavailable({}, { locale }),
  empty: (locale) => m.search_locate_empty({}, { locale }),
};

function ClearIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12.5 3.5L3.5 12.5M12.5 12.5L3.5 3.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function GpsFixIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M15 7.625H13.3606C13.2684 6.33321 12.7135 5.11797 11.7978 4.20221C10.882 3.28646 9.66679 2.73158 8.375 2.63937V1C8.375 0.900544 8.33549 0.805161 8.26517 0.734835C8.19484 0.664509 8.09946 0.625 8 0.625C7.90054 0.625 7.80516 0.664509 7.73484 0.734835C7.66451 0.805161 7.625 0.900544 7.625 1V2.63937C6.33321 2.73158 5.11797 3.28646 4.20221 4.20221C3.28646 5.11797 2.73158 6.33321 2.63937 7.625H1C0.900544 7.625 0.805161 7.66451 0.734835 7.73484C0.664509 7.80516 0.625 7.90054 0.625 8C0.625 8.09946 0.664509 8.19484 0.734835 8.26517C0.805161 8.33549 0.900544 8.375 1 8.375H2.63937C2.73158 9.66679 3.28646 10.882 4.20221 11.7978C5.11797 12.7135 6.33321 13.2684 7.625 13.3606V15C7.625 15.0995 7.66451 15.1948 7.73484 15.2652C7.80516 15.3355 7.90054 15.375 8 15.375C8.09946 15.375 8.19484 15.3355 8.26517 15.2652C8.33549 15.1948 8.375 15.0995 8.375 15V13.3606C9.66679 13.2684 10.882 12.7135 11.7978 11.7978C12.7135 10.882 13.2684 9.66679 13.3606 8.375H15C15.0995 8.375 15.1948 8.33549 15.2652 8.26517C15.3355 8.19484 15.375 8.09946 15.375 8C15.375 7.90054 15.3355 7.80516 15.2652 7.73484C15.1948 7.66451 15.0995 7.625 15 7.625ZM8 12.625C7.08526 12.625 6.19106 12.3537 5.43049 11.8455C4.66991 11.3373 4.07711 10.615 3.72706 9.76991C3.377 8.9248 3.28541 7.99487 3.46387 7.09771C3.64232 6.20055 4.08281 5.37645 4.72963 4.72963C5.37645 4.08281 6.20055 3.64232 7.09771 3.46387C7.99487 3.28541 8.9248 3.377 9.76991 3.72706C10.615 4.07711 11.3373 4.66991 11.8455 5.43049C12.3537 6.19106 12.625 7.08526 12.625 8C12.6235 9.22617 12.1358 10.4017 11.2687 11.2687C10.4017 12.1358 9.22617 12.6235 8 12.625ZM8 5.625C7.53027 5.625 7.07109 5.76429 6.68052 6.02526C6.28995 6.28623 5.98554 6.65715 5.80579 7.09113C5.62603 7.5251 5.57899 8.00264 5.67063 8.46334C5.76227 8.92404 5.98847 9.34723 6.32062 9.67938C6.65277 10.0115 7.07596 10.2377 7.53666 10.3294C7.99737 10.421 8.4749 10.374 8.90887 10.1942C9.34285 10.0145 9.71377 9.71005 9.97474 9.31948C10.2357 8.92891 10.375 8.46973 10.375 8C10.375 7.37011 10.1248 6.76602 9.67938 6.32062C9.23398 5.87522 8.62989 5.625 8 5.625ZM8 9.625C7.67861 9.625 7.36443 9.5297 7.0972 9.35114C6.82997 9.17258 6.62169 8.91879 6.4987 8.62186C6.3757 8.32493 6.34352 7.9982 6.40622 7.68298C6.46892 7.36776 6.62369 7.07821 6.85095 6.85095C7.07821 6.62369 7.36776 6.46892 7.68298 6.40622C7.9982 6.34352 8.32493 6.3757 8.62186 6.4987C8.91879 6.62169 9.17258 6.82997 9.35114 7.0972C9.5297 7.36443 9.625 7.67861 9.625 8C9.625 8.43098 9.4538 8.8443 9.14905 9.14905C8.8443 9.4538 8.43098 9.625 8 9.625Z" />
    </svg>
  );
}

function getLocateError(error: GeolocationPositionError): LocateError {
  return error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
}

function syncCaret(
  input: HTMLInputElement | null,
  mirror: HTMLSpanElement | null,
  caret: HTMLSpanElement | null,
) {
  if (!input || !mirror || !caret) return;
  const isCollapsed =
    document.activeElement === input && input.selectionStart === input.selectionEnd;
  caret.hidden = !isCollapsed;
  if (!isCollapsed) return;
  mirror.textContent = input.value.slice(0, input.selectionStart ?? 0);
  caret.style.translate = `${mirror.offsetWidth - input.scrollLeft}px 0`;
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
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const { place } = search;
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const [text, setText] = useState(place ?? '');
  const [syncedPlace, setSyncedPlace] = useState(place);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<LocateError | null>(null);
  const suggestions = useMemo(() => getRegionSuggestions(earthquakes, text), [earthquakes, text]);
  const isListShown = isOpen && text.trim() !== '';
  const hasOptions = isListShown && suggestions.length > 0;
  const optionIndex = Math.min(activeIndex, Math.max(suggestions.length - 1, 0));
  const controlsId = hasOptions ? listboxId : undefined;
  const activeOption = hasOptions ? `${listboxId}-${optionIndex}` : undefined;

  if (place !== syncedPlace) {
    setSyncedPlace(place);
    setText(place ?? '');
    setActiveIndex(0);
  }

  function selectPlace(name: string) {
    setText(name);
    setIsOpen(false);
    setActiveIndex(0);
    setLocateError(null);
    void setSearch({ place: name });
  }

  function pick(suggestion: RegionSuggestion) {
    selectPlace(suggestion.name);
  }

  function clear() {
    setText('');
    setIsOpen(false);
    setActiveIndex(0);
    if (place !== undefined) void setSearch({ place: undefined });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setActiveIndex(0);
    setLocateError(null);
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
      if (hasOptions) setActiveIndex(getNextIndex(optionIndex, step, suggestions.length));
      return;
    }
    const suggestion = suggestions.at(optionIndex);
    if (event.key !== 'Enter' || !hasOptions || !suggestion) return;
    event.preventDefault();
    pick(suggestion);
  }

  function handleClearClick() {
    clear();
    inputRef.current?.focus();
  }

  function handleLocateClick() {
    if (isLocating) return;
    setLocateError(null);
    if (!('geolocation' in navigator)) {
      setLocateError('unavailable');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsLocating(false);
        const region = getNearestRegion(earthquakes, coords);
        if (region === null) setLocateError('empty');
        else selectPlace(region);
      },
      (error) => {
        setIsLocating(false);
        setLocateError(getLocateError(error));
      },
      LOCATE_OPTIONS,
    );
  }

  function updateCaret() {
    syncCaret(inputRef.current, mirrorRef.current, caretRef.current);
  }

  function handleFocus() {
    setIsOpen(true);
    updateCaret();
  }

  function handleBlur() {
    setIsOpen(false);
    updateCaret();
  }

  useLayoutEffect(() => {
    syncCaret(inputRef.current, mirrorRef.current, caretRef.current);
  }, [text]);

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
      data-label-obstacle
      className="pointer-events-auto mt-4 flex flex-col md:absolute md:bottom-14 md:left-14 md:z-20 md:mt-0 md:block md:w-[257px]"
    >
      {isListShown && (
        <div className="order-last mt-2 border border-line bg-glass-panel py-1 backdrop-blur-[50px] md:absolute md:inset-x-0 md:bottom-full md:mt-0 md:mb-2">
          <Suggestions
            id={listboxId}
            suggestions={suggestions}
            activeIndex={optionIndex}
            onPick={pick}
          />
        </div>
      )}
      <div className="flex items-center gap-7 border-b border-muted has-[input:focus-visible]:border-accent has-[input:focus-visible]:shadow-[0_1px_0_var(--color-accent)] md:gap-2.5 md:pb-2.5">
        <div className="relative flex min-w-0 flex-1">
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
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSelect={updateCaret}
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground uppercase caret-transparent outline-none placeholder:text-muted md:h-4 md:text-label forced-colors:caret-[auto] max-md:placeholder:text-[12px] max-md:placeholder:font-medium max-md:placeholder:tracking-[0.2em]"
          />
          <span
            ref={mirrorRef}
            aria-hidden="true"
            className="invisible absolute top-0 left-0 text-base whitespace-pre uppercase md:text-label"
          />
          <span
            ref={caretRef}
            aria-hidden="true"
            hidden
            data-testid="search-caret"
            className="pointer-events-none absolute inset-y-0 left-0 my-auto h-[12.1px] w-[9.8px] bg-accent forced-colors:hidden"
          />
        </div>
        {text !== '' && (
          <button
            type="button"
            aria-label={m.search_clear({}, { locale })}
            onClick={handleClearClick}
            className="-mx-3.5 flex size-11 shrink-0 cursor-pointer items-center justify-center text-muted hover:text-foreground focus-visible:text-foreground md:-m-1 md:size-6"
          >
            <ClearIcon />
          </button>
        )}
        <button
          type="button"
          aria-label={m.search_locate({}, { locale })}
          aria-busy={isLocating}
          onClick={handleLocateClick}
          className="-mx-3.5 flex size-11 shrink-0 cursor-pointer items-center justify-center text-foreground hover:text-accent aria-busy:animate-pulse motion-reduce:aria-busy:animate-none md:-m-1 md:size-6"
        >
          <GpsFixIcon />
        </button>
      </div>
      {locateError && (
        <p
          role="alert"
          className="mt-2 text-body-s text-muted md:absolute md:inset-x-0 md:top-full"
        >
          {LOCATE_ERROR_MESSAGES[locateError](locale)}
        </p>
      )}
    </div>
  );
}
