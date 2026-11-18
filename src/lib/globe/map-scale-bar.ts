import { getIntlLocale } from '@/lib/i18n/intl-locale';

export const SCALE_BAR_MAX_PX = 140;
const SCALE_BAR_MID_MIN_PX = 120;
const METRES_PER_KM = 1000;
const SCALE_BAR_STEPS_KM = [
  0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500,
  1000, 2000, 2500, 5000,
] as const;

export type ScaleBar = { km: number; widthPx: number };
export type ScaleBarLabels = { start: string; mid: string | null; end: string };

export function getScaleBar(kmPerPx: number, maxWidthPx = SCALE_BAR_MAX_PX): ScaleBar | null {
  if (!(kmPerPx > 0) || !Number.isFinite(kmPerPx)) return null;
  const km =
    SCALE_BAR_STEPS_KM.findLast((step) => step / kmPerPx <= maxWidthPx) ?? SCALE_BAR_STEPS_KM[0];
  return { km, widthPx: km / kmPerPx };
}

function getScaleUnit(km: number): { unit: 'kilometer' | 'meter'; factor: number } {
  if (km >= 1) return { unit: 'kilometer', factor: 1 };
  return { unit: 'meter', factor: METRES_PER_KM };
}

export function getScaleBarLabels({ km, widthPx }: ScaleBar, locale: string): ScaleBarLabels {
  const { unit, factor } = getScaleUnit(km);
  const intlLocale = getIntlLocale(locale);
  const number = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 });
  const end = new Intl.NumberFormat(intlLocale, {
    style: 'unit',
    unit,
    maximumFractionDigits: 2,
  }).format(km * factor);
  const mid = widthPx > SCALE_BAR_MID_MIN_PX ? number.format((km * factor) / 2) : null;
  return { start: number.format(0), mid, end };
}
