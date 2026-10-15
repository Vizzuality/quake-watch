import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PaginationState, SortingState, Updater } from '@tanstack/react-table';
import { useMemo } from 'react';

import { DataTable } from '@/components/ui/data-table/data-table';
import { Pagination } from '@/components/ui/data-table/pagination';
import { EarthquakeCards } from '@/containers/search/cards';
import { EARTHQUAKE_COLUMN_CLASS_NAMES, getEarthquakeColumns } from '@/containers/search/columns';
import { NoResults, SourceErrorAlert } from '@/containers/search/states';
import { TruncatedNotice } from '@/containers/shell/truncated-notice';
import { useArrivedEarthquakes } from '@/hooks/use-arrived-earthquakes';
import { useEarthquakeSearch, useSetEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getUpdatedValue, useAppTable } from '@/lib/data-table/table';
import { SOURCE_ADAPTERS, earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import {
  EARTHQUAKE_PAGE_SIZE,
  getEarthquakeRows,
  getPageIndex,
  getTableSorting,
} from '@/lib/earthquakes/rows';
import { getSearchCenter, getSortParam } from '@/lib/earthquakes/search-schema';
import type { EarthquakeSearch } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

const ARRIVAL_ROW_CLASS_NAME = 'motion-safe:animate-arrive motion-reduce:bg-mag-4/10';

function getSearchKey({
  source,
  place,
  lat,
  lon,
  radius,
  period,
  from,
  to,
  minmag,
}: EarthquakeSearch) {
  return JSON.stringify([source, place, lat, lon, radius, period, from, to, minmag]);
}

export function SearchTable() {
  const search = useEarthquakeSearch();
  const setSearch = useSetEarthquakeSearch();
  const { data, isPending, isPlaceholderData, isError, refetch, dataUpdatedAt } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });

  const { lat, lon } = search;
  const locale = getLocale();
  const center = getSearchCenter(search);
  const hasDistance = center !== null;
  const sourceLabel = SOURCE_ADAPTERS[search.source].label;
  const earthquakes = data?.earthquakes;
  const rows = useMemo(
    () =>
      getEarthquakeRows(
        earthquakes ?? [],
        lat === undefined || lon === undefined ? null : { latitude: lat, longitude: lon },
      ),
    [earthquakes, lat, lon],
  );
  const earthquakeIds = useMemo(
    () => (isPlaceholderData ? undefined : earthquakes?.map(({ id }) => id)),
    [earthquakes, isPlaceholderData],
  );
  const arrivedIds = useArrivedEarthquakes(getSearchKey(search), earthquakeIds);
  const columns = useMemo(
    () =>
      getEarthquakeColumns({
        hasDistance,
        locale,
        now: dataUpdatedAt,
        place: search.place,
        arrivedIds,
      }),
    [hasDistance, locale, dataUpdatedAt, search.place, arrivedIds],
  );
  const sorting = getTableSorting(search.sort, hasDistance);
  const pagination = {
    pageIndex: getPageIndex(search.page, rows.length),
    pageSize: EARTHQUAKE_PAGE_SIZE,
  };
  const isEmpty = !isPending && !isError && rows.length === 0;

  const table = useAppTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, pagination },
    autoResetPageIndex: false,
    onSortingChange: (updater: Updater<SortingState>) =>
      setSearch({ sort: getSortParam(getUpdatedValue(updater, sorting)) }),
    onPaginationChange: (updater: Updater<PaginationState>) =>
      setSearch({ page: getUpdatedValue(updater, pagination).pageIndex + 1 }),
  });

  return (
    <section aria-busy={isPending || isPlaceholderData} className="flex flex-col gap-3">
      {isError ? (
        <SourceErrorAlert sourceLabel={sourceLabel} onRetry={() => void refetch()} />
      ) : null}
      {data?.isTruncated ? <TruncatedNotice /> : null}
      {isEmpty ? (
        <NoResults />
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable
              table={table}
              isLoading={isPending}
              caption={m.table_caption()}
              columnClassNames={EARTHQUAKE_COLUMN_CLASS_NAMES}
              getRowClassName={(row) =>
                arrivedIds.has(row.id) ? ARRIVAL_ROW_CLASS_NAME : undefined
              }
            />
          </div>
          <div className="lg:hidden">
            <EarthquakeCards
              table={table}
              isLoading={isPending}
              locale={locale}
              now={dataUpdatedAt}
              place={search.place}
              arrivedIds={arrivedIds}
              arrivedClassName={ARRIVAL_ROW_CLASS_NAME}
            />
          </div>
          <Pagination table={table} />
        </>
      )}
    </section>
  );
}
