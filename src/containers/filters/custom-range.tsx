import { useId, useState } from 'react';

import { useFilterSearch } from '@/hooks/use-filter-search';
import {
  CUSTOM_MAX_DAYS,
  type CustomRangeError,
  getCustomRangeError,
  getIsoDate,
} from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

type CustomRangeProps = { from: string | undefined; to: string | undefined };
type Range = { from: string; to: string };

const ERROR_MESSAGES: Record<CustomRangeError, () => string> = {
  missing: () => m.filter_custom_error_missing(),
  order: () => m.filter_custom_error_order(),
  future: () => m.filter_custom_error_future(),
  span: () => m.filter_custom_error_span({ days: CUSTOM_MAX_DAYS }),
};

const INPUT_CLASS_NAME =
  'h-11 w-full min-w-0 border-b border-line bg-transparent text-base text-foreground [color-scheme:dark] outline-none focus-visible:border-accent aria-invalid:border-accent md:h-6 md:text-[12px]';
const LABEL_CLASS_NAME =
  'text-[9.5px] leading-[1.2] font-medium tracking-[0.2em] text-muted uppercase';

function getNow(): number {
  return Date.now();
}

export function CustomRange({ from = '', to = '' }: CustomRangeProps) {
  const setSearch = useFilterSearch();
  const id = useId();
  const errorId = `${id}-error`;
  const [now] = useState(getNow);
  const [draft, setDraft] = useState<Range>({ from, to });
  const [synced, setSynced] = useState<Range>({ from, to });
  const today = getIsoDate(now);
  const error = getCustomRangeError(draft.from, draft.to, now);

  if (synced.from !== from || synced.to !== to) {
    setSynced({ from, to });
    setDraft({ from, to });
  }

  function handleChange(patch: Partial<Range>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (getCustomRangeError(next.from, next.to, Date.now()) === null) void setSearch(next);
  }

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="mt-2 pb-2 md:mt-0 md:pb-0">
      <legend className="sr-only">{m.filter_custom_label()}</legend>
      <div className="grid grid-cols-2 gap-3 md:gap-[14px]">
        <label className="flex min-w-0 flex-col gap-1">
          <span className={LABEL_CLASS_NAME}>{m.filter_custom_from()}</span>
          <input
            type="date"
            required
            value={draft.from}
            max={draft.to || today}
            aria-invalid={error !== null}
            onChange={(event) => handleChange({ from: event.target.value })}
            className={INPUT_CLASS_NAME}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className={LABEL_CLASS_NAME}>{m.filter_custom_to()}</span>
          <input
            type="date"
            required
            value={draft.to}
            min={draft.from || undefined}
            max={today}
            aria-invalid={error !== null}
            onChange={(event) => handleChange({ to: event.target.value })}
            className={INPUT_CLASS_NAME}
          />
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-body-s text-accent">
          {ERROR_MESSAGES[error]()}
        </p>
      )}
    </fieldset>
  );
}
