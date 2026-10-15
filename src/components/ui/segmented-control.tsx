import { cn } from '@/lib/utils';

type SegmentedOption<T extends string> = { value: T; label: string };

function getSegmentClassName(isSelected: boolean): string {
  return isSelected ? 'bg-fg text-canvas' : 'text-muted hover:text-fg';
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onValueChange: (value: T) => void;
}) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 inline-flex h-8 rounded-md border border-line-strong bg-surface p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            'rounded px-2 text-xs font-medium',
            getSegmentClassName(option.value === value),
          )}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
