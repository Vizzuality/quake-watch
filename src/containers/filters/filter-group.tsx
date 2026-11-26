import { type ReactNode, useId } from 'react';

import { InfoLabel } from '@/components/info-button/info-button';

export type FilterGroupOption<T> = { value: T; label: string };

type FilterGroupProps<T> = {
  label: string;
  info: string;
  options: readonly FilterGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  children?: ReactNode;
};

export function FilterGroup<T extends string | number>({
  label,
  info,
  options,
  value,
  onChange,
  children,
}: FilterGroupProps<T>) {
  const id = useId();
  const labelId = `${id}-label`;

  return (
    <div className="flex flex-col gap-0.5 border-t border-line pt-3.5 pb-0.5 md:gap-[9px] md:py-4">
      <div className="flex h-4 items-center">
        <InfoLabel
          label={label}
          info={info}
          labelId={labelId}
          className="text-[9.5px] leading-[1.2] font-medium tracking-[0.2em] text-muted uppercase"
        />
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-x-3 md:min-h-[17px] md:items-start md:gap-x-[14px] md:gap-y-2"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center md:inline md:min-h-0 md:min-w-0"
          >
            <input
              type="radio"
              name={id}
              className="peer sr-only"
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className="block border-b border-transparent pb-[3px] text-[10.5px] leading-[1.2] font-medium tracking-[0.2em] whitespace-nowrap text-muted uppercase transition-colors peer-checked:border-foreground peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent hover:text-accent">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {children}
    </div>
  );
}
