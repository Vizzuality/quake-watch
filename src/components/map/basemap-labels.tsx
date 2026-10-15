import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { getLocalizedNameField, isPlaceNameField } from '@/lib/map/basemap-labels';

export function BasemapLabels({ locale }: { locale: string }) {
  const { current: map } = useMap();

  useEffect(() => {
    const instance = map?.getMap();
    if (!instance) return;
    const field = getLocalizedNameField(locale);
    const fieldKey = JSON.stringify(field);

    const localize = () => {
      if (!instance.style?._loaded) return;
      for (const layer of instance.getStyle().layers) {
        if (layer.type !== 'symbol') continue;
        const current = instance.getLayoutProperty(layer.id, 'text-field');
        if (!isPlaceNameField(current) || JSON.stringify(current) === fieldKey) continue;
        instance.setLayoutProperty(layer.id, 'text-field', field);
      }
    };

    localize();
    instance.on('styledata', localize);
    return () => {
      instance.off('styledata', localize);
    };
  }, [map, locale]);

  return null;
}
