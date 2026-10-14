import { useId } from 'react';

import { getBubbleRadius } from '@/lib/felt-reports/bubbles';
import { m } from '@/paraglide/messages';

const FEW_REPORTS = 1;
const MANY_REPORTS = 50;

function SizeSwatch({ reports, label }: { reports: number; label: string }) {
  const diameter = getBubbleRadius(reports) * 2;
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="shrink-0 rounded-full bg-paper/25 ring-1 ring-paper/60"
        style={{ width: diameter, height: diameter }}
      />
      {label}
    </li>
  );
}

export function FeltReportsSizeKey() {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={titleId} className="font-medium text-paper">
        {m.detail_felt_legend_size_title()}
      </span>
      <ul aria-labelledby={titleId} className="flex items-center gap-4">
        <SizeSwatch reports={FEW_REPORTS} label={m.detail_felt_legend_size_few()} />
        <SizeSwatch reports={MANY_REPORTS} label={m.detail_felt_legend_size_many()} />
      </ul>
    </div>
  );
}
