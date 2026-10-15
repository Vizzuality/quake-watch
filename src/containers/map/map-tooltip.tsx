import type { ReactNode } from 'react';
import { Popup } from 'react-map-gl/maplibre';

export function MapTooltip({
  latitude,
  longitude,
  offset,
  interactive = false,
  children,
}: {
  latitude: number;
  longitude: number;
  offset: number;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <Popup
      latitude={latitude}
      longitude={longitude}
      offset={offset}
      closeButton={false}
      closeOnClick={false}
      focusAfterOpen={false}
      className={interactive ? 'quake-tooltip quake-tooltip-interactive' : 'quake-tooltip'}
      maxWidth="none"
    >
      <div
        role="tooltip"
        className="rounded-md border border-line-strong bg-surface px-3 py-2 text-xs text-fg"
      >
        {children}
      </div>
    </Popup>
  );
}
