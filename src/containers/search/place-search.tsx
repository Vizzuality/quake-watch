import { Combobox } from '@base-ui/react/combobox';
import { useQuery } from '@tanstack/react-query';
import { LocateFixedIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useEarthquakeSearch, useSetEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getSearchCenter } from '@/lib/earthquakes/search-schema';
import type { EarthquakeSearch } from '@/lib/earthquakes/search-schema';
import { getRoundedCoordinate } from '@/lib/places/coordinates';
import type { Place } from '@/lib/places/photon';
import {
  PLACE_QUERY_DEBOUNCE_MS,
  PLACE_QUERY_MIN_LENGTH,
  placeSuggestionsQueryOptions,
} from '@/lib/places/query-options';
import { m } from '@/paraglide/messages';

const PERMISSION_DENIED = 1;

function getLocationErrorMessage(code: number): string {
  return code === PERMISSION_DENIED ? m.location_denied() : m.location_unavailable();
}

function getPlacePlaceholder(search: EarthquakeSearch): string {
  return getSearchCenter(search) && !search.place ? m.place_my_location() : m.place_placeholder();
}

function getSuggestionStatus(text: string, isFetching: boolean): string {
  if (text.trim().length < PLACE_QUERY_MIN_LENGTH) return m.place_min_chars();
  if (isFetching) return m.place_searching();
  return m.place_no_suggestions();
}

export function PlaceSearch({ id }: { id: string }) {
  const search = useEarthquakeSearch();
  const setSearch = useSetEarthquakeSearch();
  const [inputValue, setInputValue] = useState(search.place ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const debouncedInput = useDebouncedValue(inputValue, PLACE_QUERY_DEBOUNCE_MS);
  const suggestions = useQuery(placeSuggestionsQueryOptions(debouncedInput));
  const places = suggestions.data ?? [];
  const hasCenter = getSearchCenter(search) !== null;

  function handleInputValueChange(value: string, { reason }: Combobox.Root.ChangeEventDetails) {
    if (reason !== 'input-clear') setInputValue(value);
  }

  function handlePlaceChange(place: Place | null) {
    if (!place) return;
    setSearch({
      place: place.name,
      lat: getRoundedCoordinate(place.latitude, 4),
      lon: getRoundedCoordinate(place.longitude, 4),
    });
  }

  function handleClearPlace() {
    setInputValue('');
    setSearch({ place: undefined, lat: undefined, lon: undefined });
  }

  function handleUseMyLocation() {
    setLocationError(null);
    if (!('geolocation' in navigator)) {
      setLocationError(m.location_unavailable());
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setSearch({
          place: undefined,
          lat: getRoundedCoordinate(coords.latitude, 2),
          lon: getRoundedCoordinate(coords.longitude, 2),
        }),
      (error) => setLocationError(getLocationErrorMessage(error.code)),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <div className="flex min-w-64 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {m.filter_place()}
      </label>
      <div className="flex gap-1.5">
        <Combobox.Root<Place>
          items={places}
          filter={null}
          open={isOpen && !suggestions.isError}
          onOpenChange={setIsOpen}
          inputValue={inputValue}
          onInputValueChange={handleInputValueChange}
          onValueChange={handlePlaceChange}
          itemToStringLabel={(place) => place.name}
          isItemEqualToValue={(a, b) => a.id === b.id}
        >
          <Combobox.Input
            id={id}
            name="place"
            autoComplete="off"
            spellCheck={false}
            placeholder={getPlacePlaceholder(search)}
            className="h-10 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm text-fg placeholder:text-muted sm:h-8"
          />
          <Combobox.Portal>
            <Combobox.Positioner sideOffset={4} align="start" className="z-50">
              <Combobox.Popup className="w-(--anchor-width) rounded-md border border-line bg-canvas p-1 text-sm shadow-lg">
                <Combobox.Empty className="px-2 py-1.5 text-xs text-muted">
                  {getSuggestionStatus(inputValue, suggestions.isFetching)}
                </Combobox.Empty>
                <Combobox.List>
                  {(place: Place) => (
                    <Combobox.Item
                      key={place.id}
                      value={place}
                      className="cursor-default rounded px-2 py-1.5 data-highlighted:bg-surface"
                    >
                      {place.label}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        {hasCenter ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.clear_place()}
            onClick={handleClearPlace}
          >
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
        <Button size="icon" aria-label={m.use_my_location()} onClick={handleUseMyLocation}>
          <LocateFixedIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {suggestions.isError ? (
        <p role="alert" className="text-xs text-alert">
          {m.place_search_error()}
        </p>
      ) : null}
      {locationError ? (
        <p role="alert" className="text-xs text-alert">
          {locationError}
        </p>
      ) : null}
    </div>
  );
}
