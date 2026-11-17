import { useId } from 'react';

export type FilterGroupOption<T> = { value: T; label: string };

type FilterGroupProps<T> = {
  label: string;
  options: readonly FilterGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function FilterGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: FilterGroupProps<T>) {
  const id = useId();
  const labelId = `${id}-label`;

  return (
    <div className="flex flex-col gap-[9px] border-t border-line py-4">
      <div className="flex h-4 items-center">
        <span
          id={labelId}
          className="text-[9.5px] leading-[1.2] font-medium tracking-[0.2em] text-muted uppercase"
        >
          {label}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex h-[17px] items-start gap-[14px]"
      >
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
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
    </div>
  );
}
