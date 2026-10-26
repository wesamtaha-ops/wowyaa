import type { ActivityDefinition } from './activity';

export interface ActivityRegistry {
  register<TConfig, TState>(activity: ActivityDefinition<TConfig, TState>): void;
  resolve(type: string, version: number): ActivityDefinition;
  has(type: string, version: number): boolean;
  list(): ReadonlyArray<{ type: string; version: number }>;
}

export class UnknownActivityError extends Error {
  constructor(type: string, version: number) {
    super(`No activity registered for ${type}@${version}`);
    this.name = 'UnknownActivityError';
  }
}

const key = (type: string, version: number) => `${type}@${version}`;

export function createActivityRegistry(): ActivityRegistry {
  const defs = new Map<string, ActivityDefinition>();
  return {
    register(activity) {
      const k = key(activity.type, activity.version);
      if (defs.has(k)) throw new Error(`Activity ${k} is already registered`);
      defs.set(k, activity as ActivityDefinition);
    },
    resolve(type, version) {
      const def = defs.get(key(type, version));
      if (!def) throw new UnknownActivityError(type, version);
      return def;
    },
    has: (type, version) => defs.has(key(type, version)),
    list: () => [...defs.values()].map((d) => ({ type: d.type, version: d.version })),
  };
}

/** Config validators keyed `type@version`, as consumed by the curriculum validator. */
export function configValidatorsFrom(
  registry: ActivityRegistry,
): ReadonlyMap<string, (raw: unknown) => unknown> {
  return new Map(
    registry.list().map(({ type, version }) => {
      const def = registry.resolve(type, version);
      return [`${type}@${version}`, (raw: unknown) => def.validateConfig(raw)] as const;
    }),
  );
}
