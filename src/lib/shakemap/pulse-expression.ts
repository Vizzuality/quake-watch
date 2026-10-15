import type { ExpressionSpecification } from 'maplibre-gl';

import {
  AMPLITUDE_RANGE,
  DECAY_RANGE_SECONDS,
  MAX_MMI,
  MIN_AMPLITUDE,
  MIN_DECAY_SECONDS,
  MIN_RISE_SECONDS,
  RISE_RANGE_SECONDS,
} from './wave';

type NumberExpression = ExpressionSpecification | number;

const SINCE: ExpressionSpecification = ['var', 'since'];
const RISE: ExpressionSpecification = ['var', 'rise'];
const DECAY: ExpressionSpecification = ['var', 'decay'];
const AMPLITUDE: ExpressionSpecification = ['var', 'amplitude'];

export function getPulseExpression(
  secondsSinceS: NumberExpression,
  mmi: NumberExpression,
): ExpressionSpecification {
  return [
    'let',
    'since',
    secondsSinceS,
    'strength',
    ['min', 1, ['max', 0, ['/', mmi, MAX_MMI]]],
    [
      'let',
      'rise',
      ['+', MIN_RISE_SECONDS, ['*', RISE_RANGE_SECONDS, ['var', 'strength']]],
      'decay',
      ['+', MIN_DECAY_SECONDS, ['*', DECAY_RANGE_SECONDS, ['var', 'strength']]],
      'amplitude',
      ['+', MIN_AMPLITUDE, ['*', AMPLITUDE_RANGE, ['var', 'strength']]],
      [
        'case',
        ['<=', SINCE, 0],
        0,
        ['<', SINCE, RISE],
        ['*', AMPLITUDE, ['sin', ['*', ['/', ['pi'], 2], ['/', SINCE, RISE]]]],
        ['>=', SINCE, ['+', RISE, DECAY]],
        0,
        [
          '*',
          ['*', AMPLITUDE, 0.5],
          ['+', 1, ['cos', ['/', ['*', ['pi'], ['-', SINCE, RISE]], DECAY]]],
        ],
      ],
    ],
  ];
}
