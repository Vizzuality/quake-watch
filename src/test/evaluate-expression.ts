type Scope = {
  properties: Record<string, unknown>;
  globalState: Record<string, unknown>;
  variables: Record<string, unknown>;
};

const NUMERIC_OPERATORS: Record<string, (values: number[]) => number | boolean> = {
  '+': (values) => values.reduce((sum, value) => sum + value, 0),
  '*': (values) => values.reduce((product, value) => product * value, 1),
  '-': ([a, b]) => (b === undefined ? -a : a - b),
  '/': ([a, b]) => a / b,
  min: (values) => values.reduce((low, value) => Math.min(low, value)),
  max: (values) => values.reduce((high, value) => Math.max(high, value)),
  sin: ([a]) => Math.sin(a),
  cos: ([a]) => Math.cos(a),
  sqrt: ([a]) => Math.sqrt(a),
  '<': ([a, b]) => a < b,
  '<=': ([a, b]) => a <= b,
  '>': ([a, b]) => a > b,
  '>=': ([a, b]) => a >= b,
  '==': ([a, b]) => a === b,
};

function getInterpolated(input: number, stops: readonly unknown[]): unknown {
  for (let index = 0; index < stops.length; index += 2) {
    const stop = Number(stops[index]);
    if (input === stop) return stops[index + 1];
    if (input < stop && index === 0) return stops[1];
    if (input < stop) {
      const [low, from, to] = [Number(stops[index - 2]), stops[index - 1], stops[index + 1]];
      if (typeof from !== 'number' || typeof to !== 'number') {
        throw new Error('Only numeric outputs interpolate between stops');
      }
      return from + ((to - from) * (input - low)) / (stop - low);
    }
  }
  return stops.at(-1);
}

function evaluate(expression: unknown, scope: Scope): unknown {
  if (!Array.isArray(expression)) return expression;
  const [operator, ...args] = expression as [string, ...unknown[]];
  switch (operator) {
    case 'get':
      return scope.properties[args[0] as string] ?? null;
    case 'global-state':
      return scope.globalState[args[0] as string] ?? null;
    case 'var':
      return scope.variables[args[0] as string];
    case 'pi':
      return Math.PI;
    case 'to-number':
      return Number(evaluate(args[0], scope) ?? 0);
    case 'let': {
      const variables = { ...scope.variables };
      for (let index = 0; index < args.length - 1; index += 2) {
        variables[args[index] as string] = evaluate(args[index + 1], scope);
      }
      return evaluate(args.at(-1), { ...scope, variables });
    }
    case 'interpolate': {
      const [, input, ...stops] = args;
      return getInterpolated(Number(evaluate(input, scope)), stops);
    }
    case 'case': {
      for (let index = 0; index < args.length - 1; index += 2) {
        if (evaluate(args[index], scope)) return evaluate(args[index + 1], scope);
      }
      return evaluate(args.at(-1), scope);
    }
    default: {
      const apply = NUMERIC_OPERATORS[operator];
      if (!apply) throw new Error(`Unsupported operator ${operator}`);
      return apply(args.map((arg) => Number(evaluate(arg, scope))));
    }
  }
}

export function getEvaluatedValue(
  expression: unknown,
  properties: Record<string, unknown> = {},
  globalState: Record<string, unknown> = {},
): unknown {
  return evaluate(expression, { properties, globalState, variables: {} });
}

export function getEvaluatedNumber(
  expression: unknown,
  properties: Record<string, unknown> = {},
  globalState: Record<string, unknown> = {},
): number {
  return Number(getEvaluatedValue(expression, properties, globalState));
}
