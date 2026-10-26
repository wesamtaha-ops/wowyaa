import { constructWord } from '@huroofi/activities-word';
import { createActivityRegistry, type ActivityRegistry } from '@huroofi/activity-sdk';
import { CURRICULUM_SCHEMA_VERSION } from '@huroofi/content-schema';
import {
  AR_FOUNDATIONS_V1_RAW,
  validatePack,
  type ConfigValidators,
  type CurriculumPack,
  type ValidationMode,
  type ValidationReport,
} from '@huroofi/curriculum';
import { masteryUpdaterV1 } from '@huroofi/learning-engine';
import {
  migrate,
  SqliteProgressRepository,
  type MigrationResult,
  type SqlDriver,
} from '@huroofi/offline-storage';

export interface BootstrapDeps {
  openDb: () => Promise<SqlDriver>;
  sha256Hex: (text: string) => Promise<string>;
  now: () => number;
  newId: () => string;
  validationMode: ValidationMode;
}

export interface BootedApp {
  repo: SqliteProgressRepository;
  registry: ActivityRegistry;
  pack: CurriculumPack;
  validation: ValidationReport;
  schema: MigrationResult;
  checksumSha256: string;
  recoveredSessions: number;
}

export class BootError extends Error {
  constructor(
    readonly code: 'content_invalid' | 'storage_failed',
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BootError';
  }
}

/**
 * Everything needed before the first child screen, all local: open + migrate the DB,
 * register activities, validate the bundled pack, activate it, and recover sessions left
 * open by a previous app kill. No network, account or remote config (plan §1.2).
 */
export async function bootstrap(deps: BootstrapDeps): Promise<BootedApp> {
  let db: SqlDriver;
  let schema: MigrationResult;
  try {
    db = await deps.openDb();
    schema = await migrate(db, undefined, deps.now);
  } catch (e) {
    throw new BootError('storage_failed', 'could not open or migrate local storage', e);
  }

  const registry = createActivityRegistry();
  registry.register(constructWord);
  const configValidators: ConfigValidators = new Map(
    registry.list().map(({ type, version }) => {
      const def = registry.resolve(type, version);
      return [`${type}@${version}`, (raw: unknown) => def.validateConfig(raw)] as const;
    }),
  );

  const validation = validatePack(AR_FOUNDATIONS_V1_RAW, {
    mode: deps.validationMode,
    configValidators,
  });
  if (!validation.ok || !validation.pack) {
    const first = validation.errors[0];
    throw new BootError(
      'content_invalid',
      `bundled content failed validation: ${first?.code} at ${first?.path}`,
    );
  }
  const pack = validation.pack;

  const checksumSha256 = await deps.sha256Hex(JSON.stringify(AR_FOUNDATIONS_V1_RAW));
  const repo = new SqliteProgressRepository({
    db,
    mastery: masteryUpdaterV1,
    now: deps.now,
    newId: deps.newId,
  });
  await repo.activateContentPack({
    packId: pack.packId,
    version: pack.version,
    schemaVersion: CURRICULUM_SCHEMA_VERSION,
    checksumSha256,
  });
  // A fresh process means any still-active session was interrupted.
  const recoveredSessions = await repo.abandonStaleSessions(deps.now());

  return { repo, registry, pack, validation, schema, checksumSha256, recoveredSessions };
}
