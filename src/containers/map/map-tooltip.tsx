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
      anchor="bottom"
      offset={offset}
      closeButton={false}
      closeOnClick={false}
      focusAfterOpen={false}
      className={interactive ? 'quake-tooltip quake-tooltip-interactive' : 'quake-tooltip'}
      maxWidth="none"
    >
      <div role="tooltip" className="rounded-lg bg-ink/90 px-3 py-2 text-xs text-paper">
        {children}
      </div>
    </Popup>
  );
}
