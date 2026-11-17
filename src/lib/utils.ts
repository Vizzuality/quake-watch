import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

export const TEXT_SIZE_TOKENS = [
  'label',
  'label-s',
  'caption',
  'caption-bold',
  'button',
  'country',
  'sea',
  'body-s',
  'body',
  'lead',
  'place',
  'place-l',
  'title',
  'title-m',
  'value',
  'value-m',
  'value-s',
  'tooltip-value',
  'stat',
  'display',
  'numeral-m',
  'numeral-l',
  'numeral-xl',
] as const;

const twMerge = extendTailwindMerge({ extend: { theme: { text: [...TEXT_SIZE_TOKENS] } } });

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
