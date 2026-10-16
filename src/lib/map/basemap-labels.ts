import type { ExpressionSpecification } from 'maplibre-gl';

export function getLocalizedNameField(locale: string): ExpressionSpecification {
  return ['coalesce', ['get', `name:${locale}`], ['get', 'name:latin'], ['get', 'name']];
}

export function isPlaceNameField(textField: unknown): boolean {
  return JSON.stringify(textField ?? null).includes('"name');
}
