import { useQuery } from '@tanstack/react-query';

import { Datum, DatumList } from '@/components/ui/explainer';
import { getRow } from '@/containers/earthquake-detail/shared/detail-row';
import type { DetailRow } from '@/containers/earthquake-detail/shared/detail-row';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import { LocalDateTime } from '@/containers/earthquake-detail/shared/local-date-time';
import type { EmscEarthquakeDetail } from '@/lib/earthquakes/details/emsc';
import { emscEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/emsc-query-options';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

function getOriginRows(detail: EmscEarthquakeDetail, locale: Locale): DetailRow[] {
  const rows = [
    getRow(detail.author, (author) => ({
      key: 'author',
      label: m.detail_emsc_label_author(),
      value: author,
      explanation: m.detail_emsc_author_explain(),
    })),
    getRow(detail.sourceCatalog, (catalog) => ({
      key: 'catalog',
      label: m.detail_emsc_label_catalog(),
      value: catalog,
      explanation: m.detail_emsc_catalog_explain(),
    })),
    getRow(detail.flynnRegion, (region) => ({
      key: 'flynn-region',
      label: m.detail_emsc_label_flynn_region(),
      value: region,
      explanation: m.detail_emsc_flynn_region_explain(),
    })),
    getRow(detail.lastUpdate, (lastUpdate) => ({
      key: 'last-update',
      label: m.detail_emsc_label_last_update(),
      value: <LocalDateTime time={lastUpdate} locale={locale} />,
      explanation: m.detail_emsc_last_update_explain(),
    })),
  ];
  return rows.filter((row) => row !== null);
}

export function EmscOriginSection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(emscEarthquakeDetailQueryOptions(earthquakeId));
  if (!data) return null;
  const rows = getOriginRows(data, getLocale());
  if (rows.length === 0) return null;

  return (
    <DetailSection
      title={m.detail_origin_title()}
      explainer={
        <>
          <p>{m.detail_emsc_origin_explainer_what()}</p>
          <p>{m.detail_emsc_origin_explainer_how()}</p>
        </>
      }
    >
      <DatumList>
        {rows.map(({ key, label, value, explanation }) => (
          <Datum key={key} label={label} value={value} explanation={explanation} />
        ))}
      </DatumList>
    </DetailSection>
  );
}
