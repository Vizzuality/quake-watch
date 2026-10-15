import { describe, expect, it } from 'vitest';

import { getAgeOpacityExpression, getCoreLayer, getHaloLayer } from '@/components/map/layers';
import { AGE_OPACITY_FLOOR, getAgeOpacity } from '@/lib/earthquakes/timeline';
import type { MapPalette } from '@/lib/theme/map-palette';

type Expr = number | string | Expr[];
type Scope = { time: number; t: number; windowStart: number; windowMs: number };

function evaluate(expr: Expr, scope: Scope): number {
  if (typeof expr === 'number') return expr;
  if (!Array.isArray(expr)) throw new Error(`unexpected literal ${expr}`);
  const [op, ...args] = expr;
  const num = (e: Expr) => evaluate(e, scope);
  switch (op) {
    case 'get':
      return scope.time;
    case 'global-state':
      return scope[args[0] as 't' | 'windowStart' | 'windowMs'];
    case 'to-number':
      return num(args[0]);
    case '-':
      return num(args[0]) - num(args[1]);
    case '/':
      return num(args[0]) / num(args[1]);
    case '>':
      return Number(num(args[0]) > num(args[1]));
    case '<':
      return Number(num(args[0]) < num(args[1]));
    case 'case':
      for (let i = 0; i + 1 < args.length; i += 2) {
        if (num(args[i])) return num(args[i + 1]);
      }
      return num(args.at(-1) as Expr);
    case 'interpolate': {
      const input = num(args[1]);
      const [x0, y0, x1, y1] = args.slice(2).map(num);
      const clamped = Math.min(Math.max(input, x0), x1);
      return y0 + ((clamped - x0) / (x1 - x0)) * (y1 - y0);
    }
    default:
      throw new Error(`unsupported op ${String(op)}`);
  }
}

const WINDOW_MS = 1000;
const T = 10_000;
const WINDOW_START = T - WINDOW_MS;

function getOpacityAt(time: number): number {
  return evaluate(getAgeOpacityExpression() as Expr, {
    time,
    t: T,
    windowStart: WINDOW_START,
    windowMs: WINDOW_MS,
  });
}

describe('getAgeOpacityExpression', () => {
  it.each([
    ['after t', T + 1, 0],
    ['before windowStart', WINDOW_START - 1, 0],
    ['age 0', T, 1],
    ['half window', T - WINDOW_MS / 2, 0.625],
    ['full window', WINDOW_START, AGE_OPACITY_FLOOR],
  ])('%s', (_label, time, expected) => {
    expect(getOpacityAt(time)).toBeCloseTo(expected);
  });

  it('matches getAgeOpacity inside the window', () => {
    for (const age of [0, 100, 333, 777, 1000]) {
      expect(getOpacityAt(T - age)).toBeCloseTo(getAgeOpacity(age, WINDOW_MS));
    }
  });
});

const PALETTE: MapPalette = {
  canvas: '#000000',
  fg: '#ffffff',
  magnitude: ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006'],
};

describe('earthquake layers', () => {
  const HALO_LAYER = getHaloLayer(PALETTE);
  const CORE_LAYER = getCoreLayer(PALETTE);

  it('scale their opacity by age', () => {
    const age = getAgeOpacityExpression();
    expect(HALO_LAYER.paint?.['circle-opacity']).toEqual(['*', 0.35, age]);
    expect(CORE_LAYER.paint?.['circle-opacity']).toEqual(['*', 0.9, age]);
    expect(CORE_LAYER.paint?.['circle-stroke-opacity']).toEqual(['*', 0.5, age]);
  });

  it('ring each Earthquake in the text color so the lightest class stays visible', () => {
    expect(CORE_LAYER.paint?.['circle-stroke-color']).toBe(PALETTE.fg);
  });
});
