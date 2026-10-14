import { queryOptions } from '@tanstack/react-query';

import { EarthquakeSourceError } from '@/lib/earthquakes/query-options';

import { getFeltReportCells } from './cells';
import type { FeltReportCell } from './cells';
import { getFeltReports } from './csv';
import { getZipEntries } from './zip';

const SEARCH_URL = 'https://www.seismicportal.eu/testimonies-ws/api/search';
const EVENTS_CSV = 'events.csv';

function getBaseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function getCsvEntry(entries: Map<string, Uint8Array>, unid: string): Uint8Array {
  const csvs = Array.from(entries).filter(
    ([name]) => name.endsWith('.csv') && getBaseName(name) !== EVENTS_CSV,
  );
  const exact = csvs.find(([name]) => getBaseName(name) === `${unid}.csv`);
  const match = exact ?? (csvs.length === 1 ? csvs[0] : undefined);
  if (!match) throw new EarthquakeSourceError('emsc', 200);
  return match[1];
}

async function getEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  try {
    return await getZipEntries(buffer);
  } catch {
    throw new EarthquakeSourceError('emsc', 200);
  }
}

export function feltReportsQueryOptions(unid: string) {
  return queryOptions({
    queryKey: ['felt-reports', unid] as const,
    queryFn: async ({ signal }): Promise<FeltReportCell[]> => {
      const url = `${SEARCH_URL}?eventid=${encodeURIComponent(unid)}&includeTestimonies=true`;
      const response = await fetch(url, { signal });
      if (!response.ok) throw new EarthquakeSourceError('emsc', response.status);
      if (response.status === 204) return [];
      const entries = await getEntries(await response.arrayBuffer());
      const csv = new TextDecoder().decode(getCsvEntry(entries, unid));
      return getFeltReportCells(getFeltReports(csv));
    },
    staleTime: Infinity,
    retry: 1,
  });
}
