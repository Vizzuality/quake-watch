import { useId } from 'react';

import { getBeachballCompressionalPath } from '@/lib/focal-mechanism/beachball';
import type { NodalPlane } from '@/lib/focal-mechanism/beachball';
import { cn } from '@/lib/utils';

const OUTLINE_WIDTH = 1;

export function Beachball({
  plane,
  size,
  title,
  className,
}: {
  plane: NodalPlane;
  size: number;
  title: string;
  className?: string;
}) {
  const titleId = useId();
  const center = size / 2;
  const radius = center - OUTLINE_WIDTH;

  return (
    <svg
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an inline SVG drawing has no <img> source; role="img" exposes it as one labelled graphic
      role="img"
      aria-labelledby={titleId}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
    >
      <title id={titleId}>{title}</title>
      <circle cx={center} cy={center} r={radius} className="fill-fg" />
      <path
        d={getBeachballCompressionalPath(plane, radius)}
        transform={`translate(${OUTLINE_WIDTH} ${OUTLINE_WIDTH})`}
        className="fill-line"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={OUTLINE_WIDTH}
        className="fill-none stroke-muted"
      />
    </svg>
  );
}
